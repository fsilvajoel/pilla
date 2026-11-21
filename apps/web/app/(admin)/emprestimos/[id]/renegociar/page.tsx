import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { canRollover } from "@/components/loans/loan-actions";
import { RolloverForm } from "@/components/loans/rollover-form";
import { PageHeader } from "@/components/shared/page-header";
import { getLoan, getPayoffQuote } from "@/lib/api/loans";
import { ApiProblem } from "@/lib/api/problem";
import { todayInBrt } from "@/lib/today";
import { renegotiateLoanAction } from "../../actions";

export default async function RenegociarPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const loan = await getLoan(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  });
  if (!canRollover(loan.status)) notFound();
  const quote = await getPayoffQuote(id, todayInBrt(new Date()));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Renegociar contrato ${loan.loanNumber}`} description={loan.personName} />
      <RolloverForm
        kind="RENEGOTIATION"
        loanId={loan.id}
        installmentCount={loan.installmentCount}
        quote={quote}
        onSubmit={renegotiateLoanAction}
      />
    </div>
  );
}
