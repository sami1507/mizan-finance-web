import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/site-metadata";
export const metadata: Metadata = { title: "إنشاء حساب | Create an account", robots: privatePageRobots };
export default function Page() { return <Suspense><AuthForm mode="register" /></Suspense>; }
