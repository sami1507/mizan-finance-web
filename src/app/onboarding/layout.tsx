import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/site-metadata";
export const metadata: Metadata = { title: "إعداد الحساب | Set up your account", robots: privatePageRobots };
export default function OnboardingLayout({ children }: { children: React.ReactNode }) { return children; }
