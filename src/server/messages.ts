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
export function validationLabel(path: PropertyKey[]): string {
  const labels: Record<string, string> = {
    name: "الاسم / Name", email: "البريد الإلكتروني / Email", amount: "المبلغ / Amount", openingBalance: "الرصيد الافتتاحي / Opening balance",
    accountId: "الحساب / Account", fromAccountId: "الحساب المصدر / Source account", toAccountId: "الحساب المستلم / Destination account",
    categoryId: "التصنيف / Category", currency: "العملة / Currency", date: "التاريخ / Date", month: "الشهر / Month", deadline: "موعد الهدف / Goal date",
    nextDate: "الاستحقاق القادم / Next due date", target: "المبلغ المستهدف / Target amount", note: "الملاحظة / Note", body: "نص الملاحظة / Note text",
    title: "العنوان / Title", frequency: "التكرار / Frequency", timezone: "المنطقة الزمنية / Time zone", locale: "اللغة / Language", rows: "صفوف الاستيراد / Import rows",
  };
  const field = String(path.at(-1) || "");
  return labels[field] || "بيانات النموذج / Form data";
}
