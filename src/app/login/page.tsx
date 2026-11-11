import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/site-metadata";
export const metadata: Metadata = { title: "تسجيل الدخول | Sign in", robots: privatePageRobots };
export default function Page() { return <Suspense><AuthForm mode="login" /></Suspense>; }
