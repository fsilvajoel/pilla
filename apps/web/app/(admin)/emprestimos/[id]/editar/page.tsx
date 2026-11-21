import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";
import { canEdit } from "@/components/loans/loan-actions";
import { EditLoanForm } from "@/components/loans/edit-loan-form";
import { PageHeader } from "@/components/shared/page-header";
import { getLoan } from "@/lib/api/loans";
import { ApiProblem } from "@/lib/api/problem";
import { updateLoanAction } from "../../actions";

export default async function EditarContratoPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const loan = await getLoan(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  });
  if (!canEdit(loan.status)) redirect(`/emprestimos/${id}`);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Editar contrato ${loan.loanNumber}`} description={loan.personName} />
      <EditLoanForm loan={loan} onUpdate={updateLoanAction} />
    </div>
  );
}
