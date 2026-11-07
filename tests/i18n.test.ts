import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createTranslator, isLocale, isRtl, localeTag, messages } from "@/lib/i18n";
import { categoryLabel, dateLabel, major, minor, money } from "@/components/finance/utils";
import type { Currency, Locale, Snapshot } from "@/lib/contracts";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : filename.endsWith(".tsx") ? [filename] : [];
  });
}

function literalText(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
}

function collectClientMessages() {
  const keys = new Map<string, Set<string>>();
  const unstableKeys: string[] = [];
  const sources = sourceFiles(path.join(process.cwd(), "src"));
  for (const filename of sources) {
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const location = (node: ts.Node) => `${path.relative(process.cwd(), filename)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
    function add(key: string | undefined, node: ts.Node) {
      if (!key?.trim()) return;
      const locations = keys.get(key) ?? new Set<string>();
      locations.add(location(node));
      keys.set(key, locations);
    }
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const isTranslation = ts.isIdentifier(expression) && expression.text === "t"
          || ts.isPropertyAccessExpression(expression) && expression.name.text === "t";
        if (isTranslation && node.arguments[1]) {
          const english = node.arguments[1];
          add(literalText(english), english);
          for (const template of [node.arguments[0], english]) {
            if (template && ts.isTemplateExpression(template)) unstableKeys.push(`${location(template)}: ${template.getText(source)}`);
          }
        }
      }
      // Form field metadata and marketing feature objects are translated at render time.
      if (ts.isPropertyAssignment(node)) {
        const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
        if (name === "en" || name === "enText") add(literalText(node.initializer), node.initializer);
      }
      // Navigation, page descriptions, onboarding steps and FAQs use adjacent AR/EN literals.
      // CSV aliases contain AR/EN/HE/DE in one list, not paired UI messages.
      const multilingualAliases = ts.isArrayLiteralExpression(node)
        && node.elements.some(element => /[\u0590-\u05ff]/.test(literalText(element) ?? ""));
      if (ts.isArrayLiteralExpression(node) && !multilingualAliases) {
        for (let index = 1; index < node.elements.length; index++) {
          const arabic = literalText(node.elements[index - 1]);
          const english = literalText(node.elements[index]);
          if (arabic && /[\u0600-\u06ff]/.test(arabic) && english && /[A-Za-z]/.test(english) && !/[\u0600-\u06ff]/.test(english)) {
            add(english, node.elements[index]);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return { keys, unstableKeys, files: sources.length };
}

describe("complete Hebrew and German presentation catalogs", () => {
  it("covers literal calls, form metadata and paired navigation/FAQ messages", () => {
    const { keys, files } = collectClientMessages();
    expect(files).toBeGreaterThan(5);
    expect(keys.size).toBeGreaterThan(100);
    const missing = [...keys].flatMap(([key, locations]) => (["he", "de"] as const)
      .filter(locale => !Object.hasOwn(messages, key) || !messages[key][locale]?.trim())
      .map(locale => `${locale}: ${JSON.stringify(key)} (${[...locations].join(", ")})`));
    expect(missing, "Every visible English message key requires Hebrew and German text").toEqual([]);
  });

  it("uses canonical Arabic and English templates without pre-interpolating user values", () => {
    expect(collectClientMessages().unstableKeys, "Move variables into {placeholders} and the third t() argument").toEqual([]);
  });

  it("preserves every named placeholder in both translations", () => {
    const mismatches = Object.entries(messages).flatMap(([key, translations]) => (["he", "de"] as const)
      .filter(locale => JSON.stringify(placeholders(key)) !== JSON.stringify(placeholders(translations[locale])))
      .map(locale => `${locale}: ${JSON.stringify(key)}`));
    expect(mismatches).toEqual([]);
  });

  it("substitutes zero and user-authored values without translating or reinterpreting them", () => {
    const name = 'Income · Müller & שלום <personal> {count} $&';
    for (const locale of ["ar", "en", "he", "de"] as const) {
      const t = createTranslator(locale);
      const daysTemplate = locale === "ar" ? "{days} أيام" : locale === "en" ? "{days} days" : messages["{days} days"][locale];
      const nameTemplate = locale === "ar" ? "مساهمة إلى {name}" : locale === "en" ? "Contribute to {name}" : messages["Contribute to {name}"][locale];
      expect(t("{days} أيام", "{days} days", { days: 0 })).toBe(daysTemplate.replace("{days}", "0"));
      expect(t("مساهمة إلى {name}", "Contribute to {name}", { name, count: 99 }))
        .toBe(nameTemplate.replace("{name}", () => name));
      expect(t("مساهمة إلى {name}", "Contribute to {name}", { name: "Income" })).toContain("Income");
    }
  });

  it("keeps user-created category names intact while translating built-in categories", () => {
    const data = { categories: [
      { id: "owner:custom-label", name: "Income", nameAr: "دخل مخصص", kind: "income", color: "#000000" },
      { id: "owner:salary", name: "Salary", nameAr: "الراتب", kind: "income", color: "#000000" },
    ] } as Snapshot;
    for (const locale of ["he", "de"] as const) {
      expect(categoryLabel(data, "owner:custom-label", locale)).toBe("Income");
      expect(categoryLabel(data, "owner:salary", locale)).toBe(messages.Salary[locale]);
    }
    expect(data.categories[0].name).toBe("Income");
  });
});

describe("locale validation and direction", () => {
  it.each<[Locale, string, boolean]>([
    ["ar", "ar-IL", true], ["en", "en-IL", false], ["he", "he-IL", true], ["de", "de-DE", false],
  ])("recognizes %s and uses the appropriate formatting tag/direction", (locale, tag, rtl) => {
    expect(isLocale(locale)).toBe(true);
    expect(localeTag(locale)).toBe(tag);
    expect(isRtl(locale)).toBe(rtl);
  });

  it.each(["", "fr", "HE", "de-DE", "he-IL", "constructor", "__proto__"])("rejects unsupported stored locale %s", value => {
    expect(isLocale(value)).toBe(false);
  });
});

describe("localized money and calendar dates", () => {
  it.each<[Locale, string, Currency]>([
    ["he", "he-IL", "ILS"], ["he", "he-IL", "USD"], ["he", "he-IL", "EUR"],
    ["de", "de-DE", "ILS"], ["de", "de-DE", "USD"], ["de", "de-DE", "EUR"],
  ])("formats %s/%s/%s using the actual CLDR currency convention", (locale, tag, currency) => {
    expect(money(123_456, currency, locale)).toBe(new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 2 }).format(1234.56));
    expect(money(-123_456, currency, locale)).toBe(new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 2 }).format(-1234.56));
  });

  it("uses a decimal comma for German display and editable values", () => {
    expect(money(123_456, "EUR", "de")).toContain("1.234,56");
    expect(major(12_345, "de")).toBe("123,45");
    expect(major(-25, "de")).toBe("-0,25");
    expect(major(12_345, "he")).toBe("123.45");
  });

  it.each<[string, number]>([
    ["123,45", 12_345], ["123.45", 12_345], [" 123,4 ", 12_340], ["0", 0],
    ["0,00", 0], ["-0,25", -25], ["-12.05", -1205], ["١٢٣٫٤٥", 12_345],
  ])("parses exact German money %s into %i minor units", (value, expected) => {
    expect(minor(value, "de")).toBe(expected);
  });

  it.each(["1.234,56", "1,234.56", "1.234", "1,234", "1 234,56", "123,456", "", "NaN"])("rejects ambiguous/grouped or overprecise German money %s", value => {
    expect(() => minor(value, "de")).toThrow();
  });

  it.each<[Locale, string]>([["he", "he-IL"], ["de", "de-DE"]])("preserves calendar days across time zones in %s", (locale, tag) => {
    const expected = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date("2026-11-07T12:00:00Z"));
    expect(dateLabel("2026-11-07", locale, "Pacific/Kiritimati")).toBe(expected);
    expect(dateLabel("2026-11-07", locale, "America/Adak")).toBe(expected);
  });

  it("formats timestamped events in the user's actual time zone", () => {
    const timestamp = "2026-11-07T00:30:00Z";
    const expected = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "America/Los_Angeles" }).format(new Date(timestamp));
    expect(dateLabel(timestamp, "de", "America/Los_Angeles")).toBe(expected);
    expect(dateLabel(timestamp, "de", "America/Los_Angeles")).not.toBe(dateLabel(timestamp, "de", "UTC"));
  });
});
