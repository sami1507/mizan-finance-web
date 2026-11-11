import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/site-metadata";
export const metadata: Metadata = { title: "العرض التجريبي | Try Mizan", robots: privatePageRobots };
export default function DemoLayout({ children }: { children: React.ReactNode }) { return children; }
