import { Landing } from "@/components/landing";
import type { Metadata } from "next";
import { publicSiteOrigin } from "@/lib/site-metadata";
const origin = publicSiteOrigin();
export const metadata: Metadata = origin ? { alternates: { canonical: origin } } : {};
export default function Home() { return <Landing />; }
