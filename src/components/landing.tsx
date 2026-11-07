"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpLeft, ArrowUpRight, Plus, Play, Moon, Sun, Wallet, Target, Layers3, ChartNoAxesCombined, Check } from "lucide-react";
import { LanguageSelect } from "./language-select";
import { isRtl } from "@/lib/i18n";
import { Brand } from "./brand";
import { usePreferences } from "./providers";

const features = [
  { Icon: Wallet, ar: "أرصدتك واضحة", en: "Know your balance", arText: "اجمع حساباتك النقدية والبنكية، وتابع رصيد كل حساب وعملة.", enText: "Keep your bank and cash accounts together, with a clear balance for each currency." },
  { Icon: ChartNoAxesCombined, ar: "إنفاقك مفهوم", en: "See where it goes", arText: "صنّف معاملاتك وقارن مصروفاتك، شهرًا بعد شهر.", enText: "Categorize transactions and compare your spending from one month to the next." },
  { Icon: Layers3, ar: "ميزانية تناسبك", en: "Set a monthly limit", arText: "حدّد مبلغًا لكل تصنيف، واعرف المصروف والمتبقي قبل نهاية الشهر.", enText: "Choose a budget for each category and see what is spent and what is left." },
  { Icon: Target, ar: "هدف تقترب منه", en: "Save with a purpose", arText: "خصّص جزءًا من أموالك لهدف محدّد، وتابع كل مساهمة.", enText: "Set money aside for a specific goal and keep track of every contribution." },
];
const steps = [
  ["أضف حسابك", "Add an account", "اختر العملة وأدخل رصيدك الحالي.", "Choose the currency and enter your current balance."],
  ["سجّل معاملاتك", "Record your transactions", "أضف دخلك ومصروفاتك، أو استورد ملف CSV بعد معاينته.", "Add income and expenses, or preview and import a CSV file."],
  ["راجع خطتك", "Review your plan", "تابع الميزانية والاستحقاقات وأهداف الادخار من لوحة واحدة.", "Check budgets, upcoming payments and savings goals in one place."],
];
const questions = [
  ["هل يتصل ميزان بحسابي البنكي؟", "Does Mizan connect to my bank?", "الحسابات يدوية حاليًا. أضف معاملاتك بنفسك أو استورد ملف CSV. لا يتم طلب بيانات دخول البنك أو تنفيذ مدفوعات.", "Accounts are manual. Add transactions yourself or import a CSV. Mizan does not request bank credentials or make payments."],
  ["هل أستطيع استخدام أكثر من عملة؟", "Can I use more than one currency?", "نعم، يدعم الشيكل والدولار واليورو. تُعرض الإجماليات منفصلة لكل عملة، ولا تُجمع باستخدام أسعار صرف مجهولة.", "Yes. ILS, USD and EUR are supported. Totals stay separate for each currency; they are never combined using an unknown exchange rate."],
  ["هل يمكنني تنزيل بياناتي؟", "Can I download my data?", "يمكنك تصدير المعاملات بصيغة CSV، وتنزيل جميع بياناتك بصيغة JSON، وطباعة التقارير أو حفظها PDF من المتصفح.", "Export transactions to CSV, download your data as JSON, or print reports and save them as PDF through your browser."],
  ["ماذا يحدث في العرض التجريبي؟", "How does the demo work?", "تُنشأ لك مساحة منفصلة ببيانات توضيحية يمكنك تعديلها. لا تختلط بحسابك الحقيقي وتنتهي جلستها تلقائيًا.", "You get a separate workspace with sample data you can edit. It stays separate from your real account and its session expires automatically."],
];

export function Landing() {
  const { t, locale, theme, setTheme } = usePreferences();
  const Arrow = isRtl(locale) ? ArrowUpLeft : ArrowUpRight;
  return (
    <div className="landing">
      <a href="#content" className="skip-link">{t("تخطي إلى المحتوى", "Skip to content")}</a>
      <header className="site-header wrap">
        <Brand />
        <nav aria-label={t("التنقل الرئيسي", "Main navigation")}>
          <a href="#features">{t("أدوات ميزان", "Features")}</a>
          <a href="#how">{t("كيف تبدأ", "How it works")}</a>
          <a href="#faq">{t("أسئلة شائعة", "FAQ")}</a>
        </nav>
        <div className="site-actions">
          <LanguageSelect compact/>
          <button className="icon-button" aria-label={t("تغيير المظهر", "Toggle theme")} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}</button>
          <Link className="login-link" href="/login">{t("تسجيل الدخول", "Sign in")}</Link>
          <Link className="btn btn-primary small" href="/register">{t("ابدأ الآن", "Get started")}<Arrow size={16}/></Link>
        </div>
      </header>

      <main id="content">
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="hero-kicker">{t("ميزان لإدارة المال الشخصي", "Mizan · Personal finance")}</div>
            <h1>{t("اعرف أين تقف.", "Know where you stand.")}<br/><span>{t("وخطّط لما هو آتٍ.", "Plan what comes next.")}</span></h1>
            <p>{t("تابع أرصدتك، سجّل مصروفاتك، وحدّد ميزانية للشهر. كل ما تحتاجه لفهم أموالك واتخاذ قرارك التالي.", "Track your balances, record your spending and set a monthly budget. A practical place to manage the money you use every day.")}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/register">{t("ابدأ الآن", "Get started")}<Arrow size={18}/></Link>
              <Link className="btn btn-secondary" href="/demo"><Play size={16}/>{t("جرّب المنصة", "Explore the demo")}</Link>
            </div>
            <div className="hero-assurance">
              <span><Check size={15}/>{t("العربية والإنجليزية والعبرية والألمانية", "Arabic, English, Hebrew & German")}</span>
              <span><Check size={15}/>{t("يمكنك تصدير بياناتك", "Export your data")}</span>
              <span><Check size={15}/>{t("حسابات يدوية", "Manual accounts")}</span>
            </div>
          </div>
          <BalanceStudy/>
        </section>

        <section className="preview-section wrap" id="preview">
          <div className="section-topline"><span className="eyebrow">{t("نظرة واحدة على حساباتك", "Your accounts at a glance")}</span><Link href="/demo">{t("افتح العرض التجريبي", "Open the demo")}<Arrow size={16}/></Link></div>
          <DashboardPreview/>
          <div className="preview-caption"><span className="demo-dot"/>{t("لقطة من المنصة ببيانات تجريبية قابلة للتعديل", "A real workspace with sample data you can edit")}</div>
        </section>

        <section className="features-section wrap" id="features">
          <div className="section-intro">
            <span className="eyebrow">{t("ما تحتاجه كل يوم", "For your everyday finances")}</span>
            <h2>{t("من أول معاملة إلى خطة الشهر.", "From a single transaction to a monthly plan.")}</h2>
            <p>{t("أدوات مترابطة تساعدك على معرفة ما تملك، وما تنفق، وما ينتظرك.", "See what you have, where it goes and what is coming up.")}</p>
          </div>
          <div className="feature-grid">{features.map(({ Icon, ar, en, arText, enText }, index) => (
            <article className="feature" key={en}><span className="feature-icon"><Icon size={27} strokeWidth={1.65}/></span><small>0{index + 1}</small><h3>{t(ar,en)}</h3><p>{t(arText,enText)}</p></article>
          ))}</div>
        </section>

        <section className="how-section" id="how">
          <div className="wrap how-inner">
            <div><span className="eyebrow">{t("ثلاث خطوات للبدء", "Three steps to get started")}</span><h2>{t("ابدأ برصيدك الحالي.", "Start with your current balance.")}<br/>{t("وأضف التفاصيل مع الوقت.", "Add the details as you go.")}</h2><Link href="/register" className="btn btn-cream">{t("أنشئ حسابك", "Create your account")}<Arrow size={17}/></Link></div>
            <div className="steps">{steps.map(([ar,en,arText,enText],index) => <article key={en}><span>0{index+1}</span><div><h3>{t(ar,en)}</h3><p>{t(arText,enText)}</p></div></article>)}</div>
          </div>
        </section>

        <section className="faq-section wrap" id="faq">
          <div className="section-intro"><span className="eyebrow">{t("قبل أن تبدأ", "Before you get started")}</span><h2>{t("أسئلة شائعة", "Common questions")}</h2><p>{t("عن الحسابات والعملات وبياناتك في ميزان.", "About accounts, currencies and your data in Mizan.")}</p></div>
          <div className="faq-list">{questions.map(([ar,en,arText,enText]) => <details key={en}><summary>{t(ar,en)}<Plus size={19}/></summary><p>{t(arText,enText)}</p></details>)}</div>
        </section>

        <section className="closing-section wrap">
          <div><h2>{t("ابدأ بصورة أوضح.", "Get a clearer picture.")}</h2><p>{t("أضف حسابك الأول، أو استكشف المنصة ببيانات تجريبية.", "Add your first account, or take a look around with sample data.")}</p></div>
          <Link href="/register" className="btn btn-primary">{t("ابدأ الآن", "Get started")}<Arrow size={18}/></Link>
        </section>
      </main>
      <footer className="site-footer wrap"><Brand/><span>© {new Date().getFullYear()} {t("ميزان لإدارة المال الشخصي", "Mizan Finance")}</span><a href="#faq">{t("الأسئلة الشائعة", "Common questions")}<Arrow size={15}/></a></footer>
    </div>
  );
}

function BalanceStudy() {
  const { t } = usePreferences();
  return (
    <figure className="balance-study">
      <div className="study-heading"><strong>{t("لكل قرار ميزانه", "Find your balance")}</strong><span>M / 01</span></div>
      <svg viewBox="0 0 420 300" fill="none" aria-hidden="true">
        <path d="M35 246H385M35 78H385" stroke="var(--border)" strokeDasharray="2 6"/>
        <path d="M210 28V248" stroke="var(--border)"/>
        <circle cx="210" cy="132" r="95" stroke="var(--border)"/>
        <path d="M210 82V239M165 250H255" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
        <path d="M88 112L332 77" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
        <path d="M101 112V187M319 80V155" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M48 188H154C149 220 128 235 101 235C74 235 53 220 48 188Z" fill="var(--green)"/>
        <path d="M266 156H372C367 188 346 203 319 203C292 203 271 188 266 156Z" fill="var(--quiet)" stroke="var(--gold)" strokeWidth="1.5"/>
        <circle cx="210" cy="94" r="9" fill="var(--gold)" stroke="var(--surface)" strokeWidth="3"/>
        <path d="M94 208H108M101 201V215" stroke="var(--action-ink)" strokeWidth="2"/>
        <path d="M312 176H326" stroke="currentColor" strokeWidth="2"/>
        <path d="M175 263H245" stroke="var(--gold)" strokeWidth="1.5"/>
      </svg>
      <figcaption>{t("حساباتك، في صورة واحدة.", "Your accounts. One clear view.")}<span>ILS / USD / EUR</span></figcaption>
    </figure>
  );
}

function DashboardPreview() {
  const { t, locale, theme } = usePreferences();
  const suffix = locale + (theme === "dark" ? "-dark" : "") + ".png";
  return <Link href="/demo" className="dashboard-preview live-preview" aria-label={t("افتح لوحة التحكم التجريبية", "Open the live demo dashboard")}><picture><source media="(max-width: 760px)" srcSet={"/dashboard-preview-mobile-" + suffix}/><Image src={"/dashboard-preview-" + suffix} width={1440} height={1050} loading="eager" alt={t("لقطة حقيقية من لوحة تحكم ميزان ببيانات تجريبية", "Actual Mizan dashboard with sample data")} unoptimized/></picture><span className="preview-hover"><Play size={17}/>{t("جرّب لوحة التحكم", "Try the dashboard")}</span></Link>;
}
