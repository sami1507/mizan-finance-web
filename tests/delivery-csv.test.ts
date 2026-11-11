import { describe, expect, it } from "vitest";
import { CSV_NOTE_ENCODING, decodeCsvNote, needsSpreadsheetEscape } from "@/lib/csv-mapping";

describe("spreadsheet-safe CSV note round trips", () => {
  it.each(["=2+2", "+2+2", "-2+2", "@SUM(1,2)", "  =HYPERLINK(\"https://example.invalid\")", "\tcommand", "\rcommand"])("escapes and reversibly decodes a formula-sensitive note %j", note => {
    expect(needsSpreadsheetEscape(note)).toBe(true);
    expect(decodeCsvNote(`'${note}`, CSV_NOTE_ENCODING)).toBe(note);
  });

  it("preserves user apostrophes and never guesses an external file's encoding", () => {
    const note = "'=2+2";
    expect(needsSpreadsheetEscape(note)).toBe(false);
    expect(decodeCsvNote(note)).toBe(note);
    expect(decodeCsvNote(note, "")).toBe(note);
    expect(decodeCsvNote(note, "unknown-format")).toBe(note);
    expect(decodeCsvNote("''=2+2", CSV_NOTE_ENCODING)).toBe("''=2+2");
    expect(decodeCsvNote("'Normal personal note", CSV_NOTE_ENCODING)).toBe("'Normal personal note");
  });

  it("preserves multilingual content, quotes, commas and embedded newlines", () => {
    const note = '=SUM(1,2) · ميزان · שלום · Müller\n"Personal note"';
    expect(decodeCsvNote(`'${note}`, CSV_NOTE_ENCODING)).toBe(note);
    const ordinary = 'ميزان · שלום · Müller, "personal"\nline two';
    expect(needsSpreadsheetEscape(ordinary)).toBe(false);
    expect(decodeCsvNote(ordinary, CSV_NOTE_ENCODING)).toBe(ordinary);
  });
});
