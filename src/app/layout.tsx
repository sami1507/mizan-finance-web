import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-arabic";
import "@fontsource-variable/noto-sans-hebrew";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = { title: { default: "ميزان | Mizan Finance", template: "%s | Mizan Finance" }, description: "مساحة واحدة لإدارة دخلك ومصروفاتك وحساباتك وميزانياتك وأهدافك. Track balances, spending, budgets and savings goals." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
