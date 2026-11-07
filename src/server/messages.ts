import type { Locale } from "../lib/contracts";

const arabic: Record<string, string> = {
  "Please sign in to continue.": "سجّل الدخول للمتابعة.",
  "Session expired. Please sign in again.": "انتهت الجلسة؛ سجّل الدخول مجددًا.",
  "Session expired.": "انتهت الجلسة؛ سجّل الدخول مجددًا.",
  "This request origin is not allowed.": "تعذر التحقق من مصدر الطلب. أعد فتح المنصة وحاول مجددًا.",
  "Send JSON data.": "صيغة الطلب غير صالحة. أعد المحاولة من المنصة.",
  "Invalid JSON data.": "تعذر قراءة بيانات الطلب. أعد المحاولة.",
  "The import is too large. Use up to 2,000 rows.": "ملف الاستيراد كبير جدًا. استخدم ٢٠٠٠ صف كحد أقصى.",
  "The request is too large.": "حجم الطلب أكبر من الحد المسموح.",
  "Type DELETE to confirm permanent deletion.": "اكتب DELETE لتأكيد الحذف النهائي.",
  "Please wait a minute before starting another demo.": "انتظر دقيقة قبل بدء عرض تجريبي جديد.",
  "Account not found.": "لم يُعثر على الحساب.",
  "Category not found.": "لم يُعثر على التصنيف.",
  "The currency must match the account. Currency conversion is not configured.": "يجب أن تطابق العملة عملة الحساب. تحويل العملات غير متاح.",
  "The category must match income or expense.": "اختر تصنيفًا يطابق نوع المعاملة: دخل أو مصروف.",
  "Your account is already set up.": "تم إعداد حسابك بالفعل.",
  "Transaction not found.": "لم يُعثر على المعاملة.",
  "Choose two different accounts.": "اختر حسابين مختلفين للتحويل.",
  "Transfers require accounts in the same currency. No exchange rate is configured.": "التحويل متاح بين حسابات بالعملة نفسها فقط؛ لا يوجد سعر صرف معتمد.",
  "The source account has insufficient funds.": "الرصيد المتاح في الحساب المصدر غير كافٍ.",
  "Budgets require an expense category.": "اختر تصنيف مصروفات للميزانية.",
  "Budget not found.": "لم يُعثر على الميزانية.",
  "Goal not found.": "لم يُعثر على هدف الادخار.",
  "Goal and account currencies must match.": "يجب أن تطابق عملة الهدف عملة الحساب.",
  "There is not enough unallocated money in this account.": "المبلغ غير المخصص لأهداف أخرى في هذا الحساب غير كافٍ.",
  "Recurring transaction not found.": "لم يُعثر على المعاملة المتكررة.",
  "Note not found.": "لم يُعثر على الملاحظة.",
  "Unknown action.": "العملية المطلوبة غير معروفة.",
  "Supported formats are csv and json.": "اختر تصدير CSV أو JSON.",
  "The start date must precede the end date.": "يجب أن يسبق تاريخ البداية تاريخ النهاية.",
  "The request could not be completed. Please try again.": "تعذر إكمال الطلب. حاول مجددًا.",
  "Password recovery is currently unavailable. Contact the administrator.": "استعادة كلمة المرور غير متاحة حاليًا. تواصل مع مسؤول المنصة.",
};
const authArabic: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  USER_ALREADY_EXISTS: "يوجد حساب بهذا البريد الإلكتروني بالفعل.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "يوجد حساب بهذا البريد الإلكتروني بالفعل.",
  INVALID_EMAIL: "أدخل بريدًا إلكترونيًا صالحًا.",
  PASSWORD_TOO_SHORT: "استخدم كلمة مرور من ١٠ أحرف على الأقل.",
  PASSWORD_TOO_LONG: "كلمة المرور طويلة جدًا؛ الحد الأقصى ١٢٨ حرفًا.",
  INVALID_TOKEN: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية.",
  TOKEN_EXPIRED: "انتهت صلاحية الرابط. اطلب رابطًا جديدًا.",
  TOO_MANY_REQUESTS: "طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا.",
  FAILED_TO_CREATE_USER: "تعذر إنشاء الحساب. حاول مجددًا.",
};
export function bilingual(message: string, code?: string): string {
  const translated = (code ? authArabic[code] : undefined) || arabic[message];
  return translated ? `${translated} / ${message}` : message;
}
const translated: Record<"he" | "de", Record<string, string>> = {
  he: {
    "Please sign in to continue.": "יש להתחבר כדי להמשיך.",
    "Session expired. Please sign in again.": "תוקף ההתחברות פג. יש להתחבר מחדש.",
    "Session expired.": "תוקף ההתחברות פג. יש להתחבר מחדש.",
    "This request origin is not allowed.": "לא ניתן לאמת את מקור הבקשה. יש לפתוח את האתר מחדש ולנסות שוב.",
    "Send JSON data.": "פורמט הבקשה אינו תקין. יש לנסות שוב דרך האתר.",
    "Invalid JSON data.": "לא ניתן לקרוא את נתוני הבקשה. יש לנסות שוב.",
    "The import is too large. Use up to 2,000 rows.": "קובץ הייבוא גדול מדי. ניתן לייבא עד 2,000 שורות.",
    "The request is too large.": "הבקשה חורגת מהגודל המותר.",
    "Type DELETE to confirm permanent deletion.": "יש להקליד DELETE כדי לאשר מחיקה לצמיתות.",
    "Please wait a minute before starting another demo.": "יש להמתין דקה לפני פתיחת הדגמה נוספת.",
    "Account not found.": "החשבון לא נמצא.",
    "Category not found.": "הקטגוריה לא נמצאה.",
    "The currency must match the account. Currency conversion is not configured.": "המטבע חייב להתאים למטבע החשבון. המרת מטבע אינה זמינה.",
    "The category must match income or expense.": "יש לבחור קטגוריה שמתאימה לסוג התנועה: הכנסה או הוצאה.",
    "Your account is already set up.": "הגדרת החשבון כבר הושלמה.",
    "Transaction not found.": "התנועה לא נמצאה.",
    "Choose two different accounts.": "יש לבחור שני חשבונות שונים להעברה.",
    "Transfers require accounts in the same currency. No exchange rate is configured.": "ניתן להעביר בין חשבונות באותו מטבע בלבד. לא הוגדר שער חליפין.",
    "The source account has insufficient funds.": "אין יתרה מספקת בחשבון המקור.",
    "Budgets require an expense category.": "יש לבחור קטגוריית הוצאה לתקציב.",
    "Budget not found.": "התקציב לא נמצא.",
    "Goal not found.": "יעד החיסכון לא נמצא.",
    "Goal and account currencies must match.": "מטבע היעד חייב להתאים למטבע החשבון.",
    "There is not enough unallocated money in this account.": "אין בחשבון מספיק כסף שלא הוקצה ליעדים אחרים.",
    "Recurring transaction not found.": "התנועה החוזרת לא נמצאה.",
    "Note not found.": "ההערה לא נמצאה.",
    "Unknown action.": "הפעולה המבוקשת אינה מוכרת.",
    "Supported formats are csv and json.": "יש לבחור ייצוא בפורמט CSV או JSON.",
    "The start date must precede the end date.": "תאריך ההתחלה חייב להיות לפני תאריך הסיום.",
    "The request could not be completed. Please try again.": "לא ניתן להשלים את הבקשה. יש לנסות שוב.",
    "Password recovery is currently unavailable. Contact the administrator.": "שחזור סיסמה אינו זמין כרגע. יש לפנות למנהל המערכת.",
    INVALID_EMAIL_OR_PASSWORD: "כתובת הדוא״ל או הסיסמה שגויה.",
    USER_ALREADY_EXISTS: "כבר קיים חשבון עם כתובת הדוא״ל הזו.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "כבר קיים חשבון עם כתובת הדוא״ל הזו.",
    INVALID_EMAIL: "יש להזין כתובת דוא״ל תקינה.",
    PASSWORD_TOO_SHORT: "הסיסמה חייבת להכיל לפחות 10 תווים.",
    PASSWORD_TOO_LONG: "הסיסמה ארוכה מדי. ניתן להשתמש בעד 128 תווים.",
    INVALID_TOKEN: "קישור איפוס הסיסמה אינו תקין או שפג תוקפו.",
    TOKEN_EXPIRED: "תוקף הקישור פג. יש לבקש קישור חדש.",
    TOO_MANY_REQUESTS: "נשלחו יותר מדי בקשות. יש להמתין מעט ולנסות שוב.",
    FAILED_TO_CREATE_USER: "לא ניתן ליצור את החשבון. יש לנסות שוב.",
  },
  de: {
    "Please sign in to continue.": "Bitte melde dich an, um fortzufahren.",
    "Session expired. Please sign in again.": "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    "Session expired.": "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    "This request origin is not allowed.": "Der Ursprung der Anfrage konnte nicht bestätigt werden. Öffne die Website erneut und versuche es noch einmal.",
    "Send JSON data.": "Das Anfrageformat ist ungültig. Bitte versuche es erneut über die Website.",
    "Invalid JSON data.": "Die Anfragedaten konnten nicht gelesen werden. Bitte versuche es erneut.",
    "The import is too large. Use up to 2,000 rows.": "Die Importdatei ist zu groß. Verwende höchstens 2.000 Zeilen.",
    "The request is too large.": "Die Anfrage überschreitet die zulässige Größe.",
    "Type DELETE to confirm permanent deletion.": "Gib DELETE ein, um die endgültige Löschung zu bestätigen.",
    "Please wait a minute before starting another demo.": "Warte bitte eine Minute, bevor du eine weitere Demo startest.",
    "Account not found.": "Das Konto wurde nicht gefunden.",
    "Category not found.": "Die Kategorie wurde nicht gefunden.",
    "The currency must match the account. Currency conversion is not configured.": "Die Währung muss mit der Kontowährung übereinstimmen. Eine Währungsumrechnung ist nicht verfügbar.",
    "The category must match income or expense.": "Wähle eine Kategorie, die zur Einnahme oder Ausgabe passt.",
    "Your account is already set up.": "Dein Konto ist bereits eingerichtet.",
    "Transaction not found.": "Die Buchung wurde nicht gefunden.",
    "Choose two different accounts.": "Wähle zwei unterschiedliche Konten für die Überweisung.",
    "Transfers require accounts in the same currency. No exchange rate is configured.": "Überweisungen sind nur zwischen Konten derselben Währung möglich. Es ist kein Wechselkurs hinterlegt.",
    "The source account has insufficient funds.": "Das Guthaben auf dem Quellkonto reicht nicht aus.",
    "Budgets require an expense category.": "Wähle eine Ausgabenkategorie für das Budget.",
    "Budget not found.": "Das Budget wurde nicht gefunden.",
    "Goal not found.": "Das Sparziel wurde nicht gefunden.",
    "Goal and account currencies must match.": "Die Währung des Sparziels muss mit der Kontowährung übereinstimmen.",
    "There is not enough unallocated money in this account.": "Auf diesem Konto ist nicht genug Geld verfügbar, das noch keinem anderen Ziel zugeordnet ist.",
    "Recurring transaction not found.": "Die wiederkehrende Buchung wurde nicht gefunden.",
    "Note not found.": "Die Notiz wurde nicht gefunden.",
    "Unknown action.": "Die angeforderte Aktion ist unbekannt.",
    "Supported formats are csv and json.": "Wähle den Export als CSV oder JSON.",
    "The start date must precede the end date.": "Das Startdatum muss vor dem Enddatum liegen.",
    "The request could not be completed. Please try again.": "Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    "Password recovery is currently unavailable. Contact the administrator.": "Die Passwortwiederherstellung ist derzeit nicht verfügbar. Wende dich an die Administration.",
    INVALID_EMAIL_OR_PASSWORD: "Die E-Mail-Adresse oder das Passwort ist falsch.",
    USER_ALREADY_EXISTS: "Für diese E-Mail-Adresse besteht bereits ein Konto.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Für diese E-Mail-Adresse besteht bereits ein Konto.",
    INVALID_EMAIL: "Gib eine gültige E-Mail-Adresse ein.",
    PASSWORD_TOO_SHORT: "Verwende ein Passwort mit mindestens 10 Zeichen.",
    PASSWORD_TOO_LONG: "Das Passwort ist zu lang. Erlaubt sind höchstens 128 Zeichen.",
    INVALID_TOKEN: "Der Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.",
    TOKEN_EXPIRED: "Der Link ist abgelaufen. Fordere einen neuen Link an.",
    TOO_MANY_REQUESTS: "Zu viele Anfragen. Warte kurz und versuche es erneut.",
    FAILED_TO_CREATE_USER: "Das Konto konnte nicht erstellt werden. Bitte versuche es erneut.",
  },
};

/** Presentation preference only. Never use this untrusted value for authentication. */
export function requestLocale(request?: Request): Locale | undefined {
  const supported = (value: string | undefined | null): Locale | undefined => {
    const locale = value?.trim().toLowerCase();
    return locale === "ar" || locale === "en" || locale === "he" || locale === "de" ? locale : undefined;
  };
  if (!request) return undefined;
  const explicit = supported(request.headers.get("x-mizan-locale"));
  if (explicit) return explicit;
  const cookie = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith("mizan-locale="))?.slice("mizan-locale=".length);
  if (cookie) {
    try { const locale = supported(decodeURIComponent(cookie)); if (locale) return locale; } catch { /* Ignore malformed preference cookies. */ }
  }
  const accepted = (request.headers.get("accept-language") || "").slice(0, 512).split(",").map(entry => {
    const [tag, ...parameters] = entry.trim().split(";");
    const quality = parameters.find(parameter => parameter.trim().startsWith("q="))?.trim().slice(2);
    return { locale: supported(tag.split("-")[0]), quality: quality === undefined ? 1 : Number(quality) };
  }).filter(entry => entry.locale && Number.isFinite(entry.quality) && entry.quality > 0 && entry.quality <= 1).sort((a, b) => b.quality - a.quality);
  return accepted[0]?.locale;
}

export function localizedMessage(message: string, locale?: Locale, code?: string): string {
  if (locale !== "he" && locale !== "de") return bilingual(message, code);
  const messages = translated[locale];
  const known = (key?: string) => key && Object.hasOwn(messages, key) ? messages[key] : undefined;
  return known(code) || known(message) || messages["The request could not be completed. Please try again."];
}

/** Plain-text mail; the link is provided by Better Auth, never by a translated string. */
export function passwordResetEmail(locale: Locale | undefined, url: string): { subject: string; text: string } {
  if (locale === "he") return {
    subject: "Mizan | איפוס הסיסמה",
    text: `לאיפוס הסיסמה שלך ב-Mizan Finance, יש לפתוח את הקישור הבא:\n\n${url}\n\nאם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מההודעה הזו.`,
  };
  if (locale === "de") return {
    subject: "Mizan | Passwort zurücksetzen",
    text: `Öffne diesen Link, um dein Passwort für Mizan Finance zurückzusetzen:\n\n${url}\n\nFalls du keine Zurücksetzung angefordert hast, kannst du diese Nachricht ignorieren.`,
  };
  return {
    subject: "Mizan | Reset your password — إعادة تعيين كلمة المرور",
    text: `Reset your Mizan Finance password / إعادة تعيين كلمة مرور ميزان:\n\n${url}\n\nIf you did not request this, ignore this message.\nإن لم تطلب ذلك، تجاهل هذه الرسالة.`,
  };
}

export function validationLabel(path: PropertyKey[], locale?: Locale): string {
  const field = String(path.at(-1) || "");
  if (locale === "he" || locale === "de") {
    const labels: Record<"he" | "de", Record<string, string>> = {
      he: { name: "שם", email: "דוא״ל", amount: "סכום", openingBalance: "יתרת פתיחה", accountId: "חשבון", accountName: "שם החשבון", accountType: "סוג החשבון", fromAccountId: "חשבון מקור", toAccountId: "חשבון יעד", categoryId: "קטגוריה", currency: "מטבע", date: "תאריך", month: "חודש", deadline: "תאריך היעד", nextDate: "מועד החיוב הבא", target: "סכום היעד", note: "הערה", body: "תוכן ההערה", title: "כותרת", frequency: "תדירות", timezone: "אזור זמן", locale: "שפה", rows: "שורות לייבוא", confirmation: "אישור", kind: "סוג התנועה", active: "מצב פעילות", type: "סוג" },
      de: { name: "Name", email: "E-Mail-Adresse", amount: "Betrag", openingBalance: "Anfangssaldo", accountId: "Konto", accountName: "Kontoname", accountType: "Kontotyp", fromAccountId: "Quellkonto", toAccountId: "Zielkonto", categoryId: "Kategorie", currency: "Währung", date: "Datum", month: "Monat", deadline: "Zieldatum", nextDate: "Nächste Fälligkeit", target: "Zielbetrag", note: "Notiz", body: "Notiztext", title: "Titel", frequency: "Häufigkeit", timezone: "Zeitzone", locale: "Sprache", rows: "Importzeilen", confirmation: "Bestätigung", kind: "Buchungsart", active: "Aktivierungsstatus", type: "Typ" },
    };
    return labels[locale][field] || (locale === "he" ? "נתוני הטופס" : "Formulardaten");
  }
  const labels: Record<string, string> = {
    name: "الاسم / Name", email: "البريد الإلكتروني / Email", amount: "المبلغ / Amount", openingBalance: "الرصيد الافتتاحي / Opening balance",
    accountId: "الحساب / Account", fromAccountId: "الحساب المصدر / Source account", toAccountId: "الحساب المستلم / Destination account",
    categoryId: "التصنيف / Category", currency: "العملة / Currency", date: "التاريخ / Date", month: "الشهر / Month", deadline: "موعد الهدف / Goal date",
    nextDate: "الاستحقاق القادم / Next due date", target: "المبلغ المستهدف / Target amount", note: "الملاحظة / Note", body: "نص الملاحظة / Note text",
    title: "العنوان / Title", frequency: "التكرار / Frequency", timezone: "المنطقة الزمنية / Time zone", locale: "اللغة / Language", rows: "صفوف الاستيراد / Import rows",
  };
  return labels[field] || "بيانات النموذج / Form data";
}
