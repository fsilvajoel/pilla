import type { ReactElement } from "react";
import { InstallmentBlocks } from "@/components/alerts/installment-blocks";
import { formatDateBr } from "@/components/loans/loan-actions";
import { PageHeader } from "@/components/shared/page-header";
import { getDashboardToday } from "@/lib/api/dashboard";

/** Dados do dia: nunca pré-renderizar no build. */
export const dynamic = "force-dynamic";

export default async function AlertasPage(): Promise<ReactElement> {
  const { referenceDate, dueToday, dueThisWeek, overdue } = await getDashboardToday();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Alertas" description={`Parcelas em ${formatDateBr(referenceDate)} (hoje em Brasília)`} />
      <InstallmentBlocks dueToday={dueToday} dueThisWeek={dueThisWeek} overdue={overdue} />
    </div>
  );
}
