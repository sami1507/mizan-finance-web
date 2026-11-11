import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { publicSiteOrigin } from "@/lib/site-metadata";
const origin = publicSiteOrigin();
const description = "مساحة واحدة لإدارة دخلك ومصروفاتك وحساباتك وميزانياتك وأهدافك. Track balances, spending, budgets and savings goals.";
export const metadata: Metadata = {
  title: { default: "ميزان | Mizan Finance", template: "%s | Mizan Finance" },
  description,
  applicationName: "Mizan Finance",
  ...(origin ? { metadataBase: new URL(origin) } : {}),
  robots: { index: !!origin, follow: !!origin },
  openGraph: {
    type: "website", siteName: "Mizan Finance", title: "ميزان | Mizan Finance", description,
    locale: "ar", alternateLocale: ["en", "he", "de"],
    ...(origin ? { images: [{ url: `${origin}/brand/social-share.png`, width: 1200, height: 630, alt: "Mizan Finance — ميزان" }] } : {}),
  },
  twitter: { card: "summary_large_image", title: "ميزان | Mizan Finance", description, ...(origin ? { images: [`${origin}/brand/social-share.png`] } : {}) },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
