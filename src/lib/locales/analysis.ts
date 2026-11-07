// Canonical English keys for charts, CSV import and purchase-impact analysis.
export const analysisMessages: Record<string, { he: string; de: string }> = {
  "More than one account matches this name. Map an account ID column or choose a default account.": {
    "he": "יש כמה חשבונות בשם הזה. יש להתאים עמודה של מזהה חשבון או לבחור חשבון ברירת מחדל.",
    "de": "Mehrere Konten haben diesen Namen. Ordne eine Konto-ID-Spalte zu oder wähle ein Standardkonto."
  },
  "More than one category matches this label. Map a category ID column or choose a default category.": {
    "he": "יש כמה קטגוריות בשם הזה. יש להתאים עמודה של מזהה קטגוריה או לבחור קטגוריית ברירת מחדל.",
    "de": "Mehrere Kategorien haben diese Bezeichnung. Ordne eine Kategorie-ID-Spalte zu oder wähle eine Standardkategorie."
  },
  "Enter an amount; you can explicitly enter zero.": {
    "he": "יש להזין סכום; אפשר להזין אפס במפורש.",
    "de": "Gib einen Betrag ein; auch null ist möglich."
  },
  "Enter a non-negative amount with up to two decimal places.": {
    "he": "יש להזין סכום שאינו שלילי, עם עד שתי ספרות אחרי הנקודה.",
    "de": "Gib einen nicht negativen Betrag mit höchstens zwei Nachkommastellen ein."
  },
  "Choose a date within the simulation period.": {
    "he": "יש לבחור תאריך בתוך תקופת הסימולציה.",
    "de": "Wähle ein Datum innerhalb des Simulationszeitraums."
  },
  "No accounts in this currency": {
    "he": "אין חשבונות במטבע הזה",
    "de": "Keine Konten in dieser Währung"
  },
  "Select a currency with an existing account, or add a {currency} account. Currencies are never combined.": {
    "he": "יש לבחור מטבע של חשבון קיים, או להוסיף חשבון במטבע {currency}. אין חיבור בין מטבעות שונים.",
    "de": "Wähle die Währung eines bestehenden Kontos oder füge ein Konto in {currency} hinzu. Verschiedene Währungen werden nie zusammengezählt."
  },
  "Manage accounts": {
    "he": "ניהול חשבונות",
    "de": "Konten verwalten"
  },
  "Simulation only": {
    "he": "סימולציה בלבד",
    "de": "Nur eine Simulation"
  },
  "Explore a purchase and a change in daily spending before you decide. Your accounts stay unchanged; these inputs are not saved.": {
    "he": "אפשר לבדוק רכישה ושינוי בהוצאות היומיות לפני שמחליטים. החשבונות אינם משתנים, והנתונים שהוזנו כאן אינם נשמרים.",
    "de": "Prüfe einen Kauf und eine Änderung deiner täglichen Ausgaben, bevor du dich entscheidest. Deine Konten bleiben unverändert; diese Eingaben werden nicht gespeichert."
  },
  "Your assumptions": {
    "he": "ההנחות שלך",
    "de": "Deine Annahmen"
  },
  "Enter what you know. We do not infer spending from your history.": {
    "he": "יש להזין את הנתונים הידועים לך. לא נגזרות הנחות לגבי הוצאות מההיסטוריה שלך.",
    "de": "Trage ein, was du weißt. Wir leiten keine Ausgaben aus deinem bisherigen Verlauf ab."
  },
  "Reset simulation": {
    "he": "איפוס הסימולציה",
    "de": "Simulation zurücksetzen"
  },
  "Start": {
    "he": "התחלה",
    "de": "Beginn"
  },
  "Horizon": {
    "he": "תקופה",
    "de": "Zeitraum"
  },
  "{days} days": {
    "he": "{days} ימים",
    "de": "{days} Tage"
  },
  "Without purchase": {
    "he": "ללא הרכישה",
    "de": "Ohne Kauf"
  },
  "Additional daily spending": {
    "he": "הוצאה יומית נוספת",
    "de": "Zusätzliche tägliche Ausgaben"
  },
  "From tomorrow, in addition to the entries below. Enter zero if none.": {
    "he": "החל ממחר, בנוסף לפעולות המפורטות למטה. אם אין הוצאה נוספת, יש להזין אפס.",
    "de": "Ab morgen, zusätzlich zu den unten aufgeführten Buchungen. Gib null ein, wenn keine weiteren Ausgaben anfallen."
  },
  "With your decision": {
    "he": "עם ההחלטה שלך",
    "de": "Mit deiner Entscheidung"
  },
  "One-time purchase amount": {
    "he": "סכום רכישה חד־פעמית",
    "de": "Einmaliger Kaufbetrag"
  },
  "Deducted once, on the date you choose.": {
    "he": "יופחת פעם אחת, בתאריך שייבחר.",
    "de": "Wird einmal am gewählten Datum abgezogen."
  },
  "Purchase date": {
    "he": "תאריך הרכישה",
    "de": "Kaufdatum"
  },
  "Daily spending with this decision": {
    "he": "הוצאה יומית עם ההחלטה הזו",
    "de": "Tägliche Ausgaben mit dieser Entscheidung"
  },
  "Follows your baseline until you edit it.": {
    "he": "תואם להוצאות הבסיס כל עוד לא שונה ידנית.",
    "de": "Entspricht deinen Basisausgaben, bis du den Wert änderst."
  },
  "Starts tomorrow throughout the period, even if the purchase is later.": {
    "he": "חל ממחר לאורך כל התקופה, גם אם הרכישה תתבצע בהמשך.",
    "de": "Gilt ab morgen für den gesamten Zeitraum, auch wenn der Kauf später erfolgt."
  },
  "Match baseline spending": {
    "he": "התאמה להוצאות הבסיס",
    "de": "Basisausgaben übernehmen"
  },
  "Your chosen reserve": {
    "he": "הרזרבה שבחרת",
    "de": "Deine gewählte Reserve"
  },
  "Additional buffer": {
    "he": "כרית ביטחון נוספת",
    "de": "Zusätzlicher Puffer"
  },
  "Money to retain in addition to protected goal allocations.": {
    "he": "סכום שיישמר בנוסף לכסף המוגן שהוקצה ליעדים.",
    "de": "Geld, das zusätzlich zu geschützten Zielzuweisungen erhalten bleiben soll."
  },
  "Protect current goal allocations": {
    "he": "הגנה על ההקצאות הנוכחיות ליעדים",
    "de": "Bestehende Zielzuweisungen schützen"
  },
  "Added to the reserve floor, never deducted as an expense.": {
    "he": "מתווסף לסף הרזרבה ואינו מופחת כהוצאה.",
    "de": "Wird zur Mindestreserve addiert und nie als Ausgabe abgezogen."
  },
  "Included recurring schedules": {
    "he": "פעולות חוזרות שנכללות בחישוב",
    "de": "Enthaltene wiederkehrende Buchungen"
  },
  "Unchecking removes every occurrence of a schedule from both simulations only; it does not pause it in your account.": {
    "he": "ביטול הסימון מוציא את כל המועדים של הפעולה משתי הסימולציות בלבד; הוא אינו משהה אותה בחשבון שלך.",
    "de": "Wenn du das Häkchen entfernst, werden alle Termine dieser Serie aus beiden Simulationen ausgeschlossen. Im Konto wird die Serie nicht pausiert."
  },
  "Income": {
    "he": "הכנסה",
    "de": "Einnahmen"
  },
  "Expense": {
    "he": "הוצאה",
    "de": "Ausgabe"
  },
  "No active recurring schedules in this currency.": {
    "he": "אין פעולות חוזרות פעילות במטבע הזה.",
    "de": "Keine aktiven wiederkehrenden Buchungen in dieser Währung."
  },
  "A recurring schedule is too old to project safely. Update its date or exclude it before continuing.": {
    "he": "מועד הפעולה החוזרת ישן מדי לחישוב אמין. יש לעדכן את התאריך או להוציא אותה מהסימולציה לפני ההמשך.",
    "de": "Eine wiederkehrende Buchung liegt zu weit zurück, um sie zuverlässig zu berechnen. Aktualisiere ihr Datum oder schließe sie vor dem Fortfahren aus."
  },
  "This scenario could not be calculated. Check the inputs and dates, or try smaller amounts if their total exceeds the supported range.": {
    "he": "לא ניתן לחשב את התרחיש. יש לבדוק את הסכומים והתאריכים, או לנסות סכומים קטנים יותר אם הסכום הכולל חורג מהטווח הנתמך.",
    "de": "Dieses Szenario konnte nicht berechnet werden. Prüfe die Eingaben und Daten oder versuche kleinere Beträge, wenn die Summe den unterstützten Bereich überschreitet."
  },
  "Overlap reviewed": {
    "he": "ההתאמה נבדקה",
    "de": "Übereinstimmung geprüft"
  },
  "Check possibly duplicated payments": {
    "he": "בדיקת תשלומים שעלולים להיות כפולים",
    "de": "Möglicherweise doppelte Zahlungen prüfen"
  },
  "Recorded and scheduled entries are both included based on your confirmation. You can undo it at any time.": {
    "he": "הפעולות הרשומות והמתוכננות נכללות יחד בהתאם לאישור שלך. אפשר לבטל את האישור בכל עת.",
    "de": "Aufgrund deiner Bestätigung werden erfasste und geplante Buchungen gemeinsam berücksichtigt. Du kannst die Bestätigung jederzeit zurücknehmen."
  },
  "Recorded entries match the date, account, category and amount of these schedules. Review the details, then uncheck the schedule in the assumptions or confirm these are separate payments before viewing results.": {
    "he": "נמצאו פעולות רשומות שתואמות לתאריך, לחשבון, לקטגוריה ולסכום של הפעולות החוזרות האלה. יש לבדוק את הפרטים ואז להסיר את הסימון בהנחות, או לאשר שמדובר בתשלומים נפרדים, לפני הצגת התוצאות.",
    "de": "Erfasste Buchungen stimmen bei Datum, Konto, Kategorie und Betrag mit diesen Serien überein. Prüfe die Details und entferne dann das Häkchen bei der Serie oder bestätige, dass es getrennte Zahlungen sind, bevor du die Ergebnisse ansiehst."
  },
  "Matching recorded entries": {
    "he": "פעולות רשומות תואמות",
    "de": "Übereinstimmende erfasste Buchungen"
  },
  "No description on the recorded entry": {
    "he": "לפעולה הרשומה אין תיאור",
    "de": "Kein Beschreibungstext zur erfassten Buchung"
  },
  "These are separate payments and should all be counted": {
    "he": "אלה תשלומים נפרדים ויש לכלול את כולם",
    "de": "Dies sind getrennte Zahlungen, die alle berücksichtigt werden sollen"
  },
  "What would this decision change?": {
    "he": "מה ההחלטה הזו תשנה?",
    "de": "Was würde diese Entscheidung verändern?"
  },
  "Enter your daily spending and purchase amount to see the comparison. Zero is an explicit value; an empty field is not an assumption.": {
    "he": "יש להזין את ההוצאה היומית ואת סכום הרכישה כדי לראות את ההשוואה. אפס הוא ערך מפורש; שדה ריק אינו הנחה.",
    "de": "Gib deine täglichen Ausgaben und den Kaufbetrag ein, um den Vergleich zu sehen. Null ist ein ausdrücklicher Wert; ein leeres Feld ist keine Annahme."
  },
  "Set your assumptions": {
    "he": "הגדרת ההנחות",
    "de": "Annahmen festlegen"
  },
  "Compare balances and your reserve": {
    "he": "השוואת היתרות והרזרבה",
    "de": "Guthaben und Reserve vergleichen"
  },
  "None during this period": {
    "he": "אין בתקופה הזו",
    "de": "Keine in diesem Zeitraum"
  },
  "Conditional on your assumptions": {
    "he": "תוצאה המותנית בהנחות שלך",
    "de": "Abhängig von deinen Annahmen"
  },
  "Below reserve": {
    "he": "מתחת לסף הרזרבה",
    "de": "Unter der Mindestreserve"
  },
  "Within reserve": {
    "he": "לא יורד מסף הרזרבה",
    "de": "Mindestreserve eingehalten"
  },
  "Proposed ending balance {balance}. First reserve breach: {breach}.": {
    "he": "יתרת הסיום בתרחיש המוצע היא {balance}. הירידה הראשונה מתחת לסף הרזרבה: {breach}.",
    "de": "Vorgeschlagenes Endguthaben: {balance}. Erste Unterschreitung der Mindestreserve: {breach}."
  },
  "Actual opening balance": {
    "he": "יתרת פתיחה בפועל",
    "de": "Tatsächliches Anfangsguthaben"
  },
  "{count} account(s) in this currency, as of {date}": {
    "he": "מספר החשבונות במטבע הזה: {count}, נכון ל־{date}",
    "de": "{count} Konto/Konten in dieser Währung, Stand {date}"
  },
  "Reserve floor": {
    "he": "סף הרזרבה",
    "de": "Mindestreserve"
  },
  "Protected goals {goals} + buffer {buffer}": {
    "he": "הקצאות מוגנות ליעדים {goals} + כרית ביטחון {buffer}",
    "de": "Geschützte Zielzuweisungen {goals} + Puffer {buffer}"
  },
  "Scenario comparison": {
    "he": "השוואת תרחישים",
    "de": "Szenariovergleich"
  },
  "Measure": {
    "he": "מדד",
    "de": "Kennzahl"
  },
  "Ending balance": {
    "he": "יתרת סוף התקופה",
    "de": "Endguthaben"
  },
  "Lowest balance and date": {
    "he": "היתרה הנמוכה ביותר והתאריך",
    "de": "Niedrigstes Guthaben und Datum"
  },
  "First reserve breach": {
    "he": "ירידה ראשונה מתחת לסף הרזרבה",
    "de": "Erste Unterschreitung der Mindestreserve"
  },
  "Change in ending balance": {
    "he": "שינוי ביתרת סוף התקופה",
    "de": "Änderung des Endguthabens"
  },
  "Proposed − baseline; a higher value means more money remaining.": {
    "he": "התרחיש המוצע פחות הבסיס; ערך גבוה יותר משמעו שנשאר יותר כסף.",
    "de": "Vorschlag minus Basis; ein höherer Wert bedeutet mehr verbleibendes Geld."
  },
  "Calculated purchase ceiling on this date": {
    "he": "תקרת הרכישה המחושבת לתאריך הזה",
    "de": "Berechnete Kaufobergrenze an diesem Datum"
  },
  "With proposed daily spending of {daily}, preserving the reserve after the purchase.": {
    "he": "בהוצאה יומית מוצעת של {daily}, תוך שמירה על הרזרבה לאחר הרכישה.",
    "de": "Bei vorgeschlagenen täglichen Ausgaben von {daily} und Erhalt der Reserve nach dem Kauf."
  },
  "A reserve shortfall occurs before the purchase date. The ceiling above does not resolve that earlier shortfall.": {
    "he": "היתרה יורדת מסף הרזרבה לפני תאריך הרכישה. התקרה שלמעלה אינה פותרת את החוסר המוקדם הזה.",
    "de": "Die Mindestreserve wird bereits vor dem Kaufdatum unterschritten. Die obige Obergrenze gleicht diesen früheren Fehlbetrag nicht aus."
  },
  "There is no positive purchase headroom. Zero does not guarantee the reserve is met; a zero purchase does not repair an existing shortfall in the plan. Review the breach dates.": {
    "he": "אין מרווח חיובי לרכישה. אפס אינו מבטיח עמידה בסף הרזרבה; רכישה בסכום אפס אינה מתקנת חוסר שכבר קיים בתוכנית. יש לבדוק את מועדי הירידה מתחת לסף.",
    "de": "Es gibt keinen positiven Spielraum für den Kauf. Null garantiert nicht, dass die Reserve eingehalten wird; ein Kauf für null behebt keinen bestehenden Fehlbetrag. Prüfe die Zeitpunkte der Unterschreitung."
  },
  "These are daily closing balances pooled within this currency. They do not guarantee funds during the day or in a particular account.": {
    "he": "אלה יתרות סוף יום המצורפות עבור המטבע הזה. הן אינן מבטיחות זמינות של כסף במהלך היום או בחשבון מסוים.",
    "de": "Dies sind zusammengefasste Tagesendstände innerhalb dieser Währung. Sie garantieren keine Verfügbarkeit während des Tages oder auf einem bestimmten Konto."
  },
  "Calculation notes": {
    "he": "הערות לחישוב",
    "de": "Hinweise zur Berechnung"
  },
  "{count} unrecorded overdue occurrence(s) are projected today. Review their original dates in the event details.": {
    "he": "מספר המועדים שעברו וטרם נרשמו, שנכללים בחישוב להיום: {count}. יש לבדוק את התאריכים המקוריים בפרטי הפעולות.",
    "de": "{count} überfällige, noch nicht erfasste Termine werden für heute angesetzt. Prüfe ihre ursprünglichen Daten in den Buchungsdetails."
  },
  "No income entries are included in this period. No salary or estimated income has been added.": {
    "he": "לא נכללות פעולות הכנסה בתקופה הזו. לא נוספו משכורת או הכנסה משוערות.",
    "de": "In diesem Zeitraum sind keine Einnahmen enthalten. Es wurde kein geschätztes Gehalt oder sonstiges Einkommen hinzugefügt."
  },
  "{count} future goal contribution(s) are not included in the current reserve floor.": {
    "he": "מספר ההקצאות העתידיות ליעדים שאינן נכללות בסף הרזרבה הנוכחי: {count}.",
    "de": "{count} zukünftige Zielzuweisungen sind nicht in der aktuellen Mindestreserve enthalten."
  },
  "Entries included in the calculation": {
    "he": "פעולות שנכללות בחישוב",
    "de": "In der Berechnung enthaltene Buchungen"
  },
  "This list contains future recorded entries and recurring schedules. Daily spending and the purchase appear in the daily table below.": {
    "he": "הרשימה כוללת פעולות שכבר נרשמו לתאריך עתידי ופעולות חוזרות. ההוצאה היומית והרכישה מוצגות בטבלה היומית למטה.",
    "de": "Diese Liste enthält bereits erfasste zukünftige Buchungen und wiederkehrende Serien. Tägliche Ausgaben und der Kauf stehen in der Tagestabelle unten."
  },
  "Projected date": {
    "he": "תאריך בחישוב",
    "de": "Datum in der Projektion"
  },
  "Entry and source": {
    "he": "פעולה ומקור",
    "de": "Buchung und Quelle"
  },
  "Type": {
    "he": "סוג",
    "de": "Typ"
  },
  "Amount": {
    "he": "סכום",
    "de": "Betrag"
  },
  "Original due date": {
    "he": "מועד מקורי",
    "de": "Ursprünglicher Fälligkeitstermin"
  },
  "Recorded entry": {
    "he": "פעולה רשומה",
    "de": "Erfasste Buchung"
  },
  "Already recorded for a future date": {
    "he": "כבר נרשמה לתאריך עתידי",
    "de": "Bereits für ein zukünftiges Datum erfasst"
  },
  "Unrecorded recurring occurrence": {
    "he": "מועד חוזר שטרם נרשם",
    "de": "Noch nicht erfasster wiederkehrender Termin"
  },
  "Overdue; projected today": {
    "he": "המועד עבר; נכלל בחישוב להיום",
    "de": "Überfällig; für heute angesetzt"
  },
  "No scheduled or future recorded entries fall within this period.": {
    "he": "אין בתקופה הזו פעולות מתוכננות או פעולות שנרשמו לתאריך עתידי.",
    "de": "In diesen Zeitraum fallen keine geplanten oder bereits erfassten zukünftigen Buchungen."
  },
  "View the full daily table": {
    "he": "הצגת הטבלה היומית המלאה",
    "de": "Vollständige Tagestabelle anzeigen"
  },
  "Date": {
    "he": "תאריך",
    "de": "Datum"
  },
  "Listed expenses": {
    "he": "הוצאות מפורטות",
    "de": "Aufgeführte Ausgaben"
  },
  "Baseline daily spending": {
    "he": "הוצאה יומית בסיסית",
    "de": "Tägliche Basisausgaben"
  },
  "Proposed daily spending": {
    "he": "הוצאה יומית מוצעת",
    "de": "Vorgeschlagene tägliche Ausgaben"
  },
  "Purchase": {
    "he": "רכישה",
    "de": "Kauf"
  },
  "Baseline balance": {
    "he": "יתרה בתרחיש הבסיס",
    "de": "Basisguthaben"
  },
  "Proposed balance": {
    "he": "יתרה בתרחיש המוצע",
    "de": "Vorgeschlagenes Guthaben"
  },
  "Difference": {
    "he": "הפרש",
    "de": "Differenz"
  },
  "How was this calculated?": {
    "he": "איך התוצאה חושבה?",
    "de": "Wie wurde das berechnet?"
  },
  "Opening balance = account opening balances + income recorded through today − expenses recorded through today. Internal transfers cancel when accounts in the same currency are pooled.": {
    "he": "יתרת הפתיחה = יתרות הפתיחה של החשבונות + הכנסות שנרשמו עד היום − הוצאות שנרשמו עד היום. העברות פנימיות מתקזזות כאשר מחברים חשבונות באותו מטבע.",
    "de": "Anfangsguthaben = Anfangsstände der Konten + bis heute erfasste Einnahmen − bis heute erfasste Ausgaben. Interne Überweisungen gleichen sich aus, wenn Konten derselben Währung zusammengefasst werden."
  },
  "Each day: previous balance + listed income − listed expenses − additional daily spending. The proposed scenario deducts the purchase once. Additional daily spending starts tomorrow, without repeating today’s actual expenses.": {
    "he": "בכל יום: היתרה הקודמת + ההכנסות המפורטות − ההוצאות המפורטות − ההוצאה היומית הנוספת. בתרחיש המוצע הרכישה מופחתת פעם אחת. ההוצאה היומית הנוספת מתחילה ממחר, בלי לספור שוב את ההוצאות שכבר נרשמו היום.",
    "de": "Für jeden Tag gilt: vorheriges Guthaben + aufgeführte Einnahmen − aufgeführte Ausgaben − zusätzliche tägliche Ausgaben. Im vorgeschlagenen Szenario wird der Kauf einmal abgezogen. Zusätzliche tägliche Ausgaben beginnen morgen; heutige tatsächliche Ausgaben werden nicht erneut gezählt."
  },
  "Reserve floor = your chosen buffer + goal contributions recorded through today when protection is enabled. Allocations are not expenses. Future goal contributions are outside this model.": {
    "he": "סף הרזרבה = כרית הביטחון שבחרת + ההקצאות ליעדים שנרשמו עד היום, כשההגנה מופעלת. הקצאות אינן הוצאות. הקצאות עתידיות ליעדים אינן חלק מהמודל.",
    "de": "Mindestreserve = gewählter Puffer + bis heute erfasste Zielzuweisungen bei aktiviertem Schutz. Zuweisungen sind keine Ausgaben. Zukünftige Zielzuweisungen gehören nicht zu diesem Modell."
  },
  "Purchase ceiling = max(0, minimum headroom above the reserve from the purchase date onward), using proposed daily spending before deducting the purchase. Negative headroom displays as zero; that does not mean the underlying plan is free of shortfalls. The ceiling cannot repair an earlier shortfall.": {
    "he": "תקרת הרכישה היא הגבוה מבין אפס לבין המרווח המזערי מעל סף הרזרבה מתאריך הרכישה ואילך, לפי ההוצאה היומית המוצעת ולפני הפחתת הרכישה. מרווח שלילי מוצג כאפס; אין פירוש הדבר שאין חוסר בתוכנית הבסיסית. התקרה אינה יכולה לתקן חוסר מוקדם יותר.",
    "de": "Kaufobergrenze = max(0, kleinster Spielraum über der Mindestreserve ab dem Kaufdatum), berechnet mit den vorgeschlagenen täglichen Ausgaben vor Abzug des Kaufs. Negativer Spielraum wird als null angezeigt; das bedeutet nicht, dass der zugrunde liegende Plan keine Fehlbeträge enthält. Die Obergrenze kann einen früheren Fehlbetrag nicht beheben."
  },
  "Future recorded entries are included once on their date. Occurrences already recorded with a recurring source key are excluded; unrecorded overdue occurrences are projected today. Schedules you exclude remain in your account.": {
    "he": "פעולות שכבר נרשמו לתאריך עתידי נכללות פעם אחת בתאריך שלהן. מועדים שכבר נרשמו עם מזהה של פעולה חוזרת אינם נספרים שוב; מועדים שעברו וטרם נרשמו נכללים בחישוב להיום. הפעולות החוזרות שהוצאת מהסימולציה נשארות בחשבון שלך.",
    "de": "Bereits erfasste zukünftige Buchungen werden einmal an ihrem Datum berücksichtigt. Termine mit bereits erfasstem Wiederholungsschlüssel werden nicht erneut gezählt; überfällige, noch nicht erfasste Termine werden für heute angesetzt. Ausgeschlossene Serien bleiben in deinem Konto bestehen."
  },
  "This is a conditional projection, not a confirmed future balance or a recommendation. No currency conversion, inflation, income, or history-based spending estimates are added. Results depend on complete data and your assumptions; transactions and balances are unchanged.": {
    "he": "זהו חישוב המותנה בהנחות, ולא יתרה עתידית מובטחת או המלצה. לא מתווספים המרת מטבע, אינפלציה, הכנסה או אומדני הוצאות המבוססים על ההיסטוריה. התוצאות תלויות בשלמות הנתונים ובהנחות שלך; הפעולות והיתרות אינן משתנות.",
    "de": "Dies ist eine bedingte Projektion, kein bestätigtes zukünftiges Guthaben und keine Empfehlung. Es werden keine Währungsumrechnung, Inflation, Einnahmen oder aus dem Verlauf geschätzten Ausgaben ergänzt. Die Ergebnisse hängen von vollständigen Daten und deinen Annahmen ab; Buchungen und Guthaben bleiben unverändert."
  },
  "Daily closing balances for both scenarios; exact values in the table below": {
    "he": "יתרות סוף יום לשני התרחישים; הערכים המדויקים מופיעים בטבלה למטה",
    "de": "Tagesendstände für beide Szenarien; genaue Werte stehen in der Tabelle unten"
  },
  "Income and expenses chart; data available in table below": {
    "he": "תרשים הכנסות והוצאות; הנתונים זמינים בטבלה למטה",
    "de": "Diagramm der Einnahmen und Ausgaben; Daten stehen in der Tabelle unten"
  },
  "Expenses": {
    "he": "הוצאות",
    "de": "Ausgaben"
  },
  "View data table": {
    "he": "הצגת הנתונים בטבלה",
    "de": "Datentabelle anzeigen"
  },
  "Month": {
    "he": "חודש",
    "de": "Monat"
  },
  "Add your first expense to see a breakdown": {
    "he": "לאחר הוספת ההוצאה הראשונה יוצג הפירוט",
    "de": "Füge deine erste Ausgabe hinzu, um eine Aufschlüsselung zu sehen"
  },
  "Spending distribution; exact values are listed alongside the chart": {
    "he": "התפלגות ההוצאות; הערכים המדויקים מוצגים לצד התרשים",
    "de": "Ausgabenverteilung; genaue Werte stehen neben dem Diagramm"
  },
  "Total spent": {
    "he": "סך ההוצאות",
    "de": "Gesamtausgaben"
  },
  "Spending by category table": {
    "he": "טבלת הוצאות לפי קטגוריה",
    "de": "Tabelle der Ausgaben nach Kategorie"
  },
  "Maximum file size is 2 MB": {
    "he": "גודל הקובץ המרבי הוא 2 MB",
    "de": "Die maximale Dateigröße beträgt 2 MB"
  },
  "The CSV could not be parsed. Check its structure and quotation marks.": {
    "he": "לא ניתן לקרוא את קובץ ה־CSV. יש לבדוק את המבנה ואת המרכאות.",
    "de": "Die CSV-Datei konnte nicht gelesen werden. Prüfe den Aufbau und die Anführungszeichen."
  },
  "Import up to 2,000 rows at a time": {
    "he": "אפשר לייבא עד 2,000 שורות בכל פעם",
    "de": "Importiere höchstens 2.000 Zeilen auf einmal"
  },
  "Invalid transaction type": {
    "he": "סוג פעולה לא תקין",
    "de": "Ungültiger Buchungstyp"
  },
  "Account not found": {
    "he": "החשבון לא נמצא",
    "de": "Konto nicht gefunden"
  },
  "Category does not match transaction type": {
    "he": "הקטגוריה אינה תואמת לסוג הפעולה",
    "de": "Die Kategorie passt nicht zum Buchungstyp"
  },
  "Use date format YYYY-MM-DD": {
    "he": "יש להשתמש בתאריך בפורמט YYYY-MM-DD",
    "de": "Verwende das Datumsformat YYYY-MM-DD"
  },
  "Amount must be positive": {
    "he": "הסכום חייב להיות חיובי",
    "de": "Der Betrag muss positiv sein"
  },
  "Currency differs from account currency": {
    "he": "המטבע שונה ממטבע החשבון",
    "de": "Die Währung weicht von der Kontowährung ab"
  },
  "Import transactions from CSV": {
    "he": "ייבוא פעולות מקובץ CSV",
    "de": "Buchungen aus CSV importieren"
  },
  "Map your columns, review your data, then save. Nothing is saved before your confirmation.": {
    "he": "יש להתאים את העמודות, לבדוק את הנתונים ואז לשמור. שום דבר לא נשמר לפני האישור שלך.",
    "de": "Ordne die Spalten zu, prüfe die Daten und speichere sie anschließend. Vor deiner Bestätigung wird nichts gespeichert."
  },
  "Close": {
    "he": "סגירה",
    "de": "Schließen"
  },
  "Choose a CSV file": {
    "he": "בחירת קובץ CSV",
    "de": "CSV-Datei auswählen"
  },
  "Up to 2 MB · Date YYYY-MM-DD · Amounts in major currency units": {
    "he": "עד 2 MB · תאריך YYYY-MM-DD · סכומים בשקלים, בדולרים או באירו",
    "de": "Bis zu 2 MB · Datum YYYY-MM-DD · Beträge in Schekel, Dollar oder Euro"
  },
  "1. Map columns": {
    "he": "1. התאמת עמודות",
    "de": "1. Spalten zuordnen"
  },
  "Choose a column": {
    "he": "בחירת עמודה",
    "de": "Spalte auswählen"
  },
  "Use default": {
    "he": "שימוש בברירת המחדל",
    "de": "Standardwert verwenden"
  },
  "Default account": {
    "he": "חשבון ברירת מחדל",
    "de": "Standardkonto"
  },
  "Default type": {
    "he": "סוג ברירת מחדל",
    "de": "Standardtyp"
  },
  "Default category": {
    "he": "קטגוריית ברירת מחדל",
    "de": "Standardkategorie"
  },
  "2. Preview and validate": {
    "he": "2. תצוגה מקדימה ובדיקה",
    "de": "2. Vorschau und Prüfung"
  },
  "valid rows": {
    "he": "שורות תקינות",
    "de": "gültige Zeilen"
  },
  "rows need attention": {
    "he": "שורות שדורשות תיקון",
    "de": "Zeilen müssen geprüft werden"
  },
  "duplicates will be skipped": {
    "he": "כפילויות שידולגו",
    "de": "Duplikate werden übersprungen"
  },
  "Category": {
    "he": "קטגוריה",
    "de": "Kategorie"
  },
  "Status": {
    "he": "מצב",
    "de": "Status"
  },
  "Duplicate — will skip": {
    "he": "כפילות — תידלג",
    "de": "Duplikat — wird übersprungen"
  },
  "Ready": {
    "he": "מוכן",
    "de": "Bereit"
  },
  "Showing the first 50 rows; all rows are validated before saving.": {
    "he": "מוצגות 50 השורות הראשונות; כל השורות נבדקות לפני השמירה.",
    "de": "Die ersten 50 Zeilen werden angezeigt; vor dem Speichern werden alle Zeilen geprüft."
  },
  "Importing…": {
    "he": "מתבצע ייבוא…",
    "de": "Import läuft…"
  },
  "Confirm import of {count} transactions": {
    "he": "אישור ייבוא של {count} פעולות",
    "de": "Import von {count} Buchungen bestätigen"
  },
  "Account": {
    "he": "חשבון",
    "de": "Konto"
  },
  "Currency": {
    "he": "מטבע",
    "de": "Währung"
  },
  "Note": {
    "he": "הערה",
    "de": "Notiz"
  }
};
