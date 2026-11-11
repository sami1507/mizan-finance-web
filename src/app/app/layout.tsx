import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/site-metadata";
export const metadata: Metadata = { title: "مساحتي المالية | My finances", robots: privatePageRobots };
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) { return children; }
