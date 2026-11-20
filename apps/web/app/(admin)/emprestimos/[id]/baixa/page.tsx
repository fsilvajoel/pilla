import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { canRollover } from "@/components/loans/loan-actions";
import { WriteOffForm } from "@/components/loans/write-off-form";
import { PageHeader } from "@/components/shared/page-header";
import { getLoan } from "@/lib/api/loans";
import { ApiProblem } from "@/lib/api/problem";
import { writeOffLoanAction } from "../../actions";

export default async function BaixaPage({
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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Baixar contrato ${loan.loanNumber} como perda`} description={loan.personName} />
      <WriteOffForm loanId={loan.id} version={loan.version} onWriteOff={writeOffLoanAction} />
    </div>
  );
}
