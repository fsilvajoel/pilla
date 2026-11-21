import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { LoanDetailView } from "@/components/loans/loan-detail-view";
import { LoanDraftActions } from "@/components/loans/loan-draft-actions";
import { canActivate, canCancel } from "@/components/loans/loan-actions";
import { getLoan, listAccounts } from "@/lib/api/loans";
import { ApiProblem } from "@/lib/api/problem";
import { todayInBrt } from "@/lib/today";
import { activateLoanAction, cancelLoanAction } from "../actions";

export default async function ContratoPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const loan = await getLoan(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  });
  const draft = canActivate(loan.status) || canCancel(loan.status);
  const accounts = draft ? (await listAccounts()).items : [];
  return (
    <LoanDetailView loan={loan}>
      {draft && (
        <LoanDraftActions
          loanId={loan.id}
          version={loan.version}
          today={todayInBrt(new Date())}
          accounts={accounts}
          onActivate={activateLoanAction}
          onCancel={cancelLoanAction}
        />
      )}
    </LoanDetailView>
  );
}
