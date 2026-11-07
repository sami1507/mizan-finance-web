import { notFound } from "next/navigation";
import FinanceApp from "@/components/finance-app";
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!["dashboard", "transactions", "accounts", "budgets", "goals", "savings", "recurring", "reports", "simulator", "insights", "settings"].includes(section)) notFound();
  return <FinanceApp section={section} />;
}
