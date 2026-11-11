import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";
import { privatePageRobots } from "@/lib/site-metadata";
export const metadata: Metadata = { title: "استعادة كلمة المرور | Reset your password", robots: privatePageRobots };
export default function Page() { return <Suspense><AuthForm mode="forgot" /></Suspense>; }
