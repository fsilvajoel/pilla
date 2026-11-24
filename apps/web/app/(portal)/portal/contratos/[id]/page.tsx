import { ArrowLeftIcon } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";
import { PortalInstallments } from "@/components/portal/portal-installments";
import { PortalPayments } from "@/components/portal/portal-payments";
import { PortalSituationBadge } from "@/components/portal/portal-situation-badge";
import { PortalSummary } from "@/components/portal/portal-summary";
import { getPortalLoan, PORTAL_COOKIE, type PortalLoanDetailResponse } from "@/lib/api/portal";
import { ApiProblem } from "@/lib/api/problem";
import { formatDate, formatReais } from "@/lib/portal-format";
import { portalTexts } from "@/lib/portal-texts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalLoanPage({ params }: PageProps): Promise<ReactElement> {
  const { id } = await params;
  const store = await cookies();
  let loan: PortalLoanDetailResponse;
  try {
    loan = await getPortalLoan(store.get(PORTAL_COOKIE)?.value, id);
  } catch (error) {
    if (error instanceof ApiProblem && error.status === 401) redirect("/portal?sessao=vencida");
    // 404 igual para contrato inexistente e de outro cliente (D10).
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  }

  const t = portalTexts.detail;
  return (
    <div className="space-y-6">
      <Link href="/portal/contratos" className="inline-flex items-center gap-2 text-base underline underline-offset-4">
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t.back}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{portalTexts.list.contract(loan.loanNumber)}</h1>
        <PortalSituationBadge situation={loan.situation} />
      </div>
      <PortalSummary loan={loan} />
      {loan.situation === "PAID_OFF" ? (
        <p className="text-lg font-medium">{t.paidOff}</p>
      ) : (
        loan.nextInstallment !== null && (
          <p className="text-lg font-medium">
            {t.nextInstallment(formatReais(loan.nextInstallment.amountCents), formatDate(loan.nextInstallment.dueDate))}
          </p>
        )
      )}
      {loan.situation !== "PAID_OFF" && loan.lateChargesCents > 0 && (
        <p role="note" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-base">
          {t.lateCharges(formatReais(loan.lateChargesCents))}
        </p>
      )}
      <PortalInstallments installments={loan.installments} />
      <PortalPayments payments={loan.payments} />
    </div>
  );
}
