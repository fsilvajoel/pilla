import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { PaymentForm } from "@/components/payment-form";
import { getLoan, listAccounts } from "@/lib/api/loans";
import { previewAllocation } from "@/lib/api/payments";
import { ApiProblem } from "@/lib/api/problem";
import { todayInBrt } from "@/lib/today";
import { createPaymentAction, previewPaymentAction } from "../../../pagamentos/actions";

/** Contrato sucessor de um contrato fechado: vem no problema de uma prévia (RN-R09). */
async function findSuccessor(loanId: string, today: string): Promise<string | undefined> {
  try {
    await previewAllocation({ loanId, amountCents: 1, paidAt: today });
  } catch (error) {
    if (error instanceof ApiProblem && error.successorLoanId !== null) return error.successorLoanId;
  }
  return undefined;
}

export default async function PaymentPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const today = todayInBrt(new Date());
  const loan = await getLoan(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  });
  const closed = loan.status === "RENEWED" || loan.status === "RENEGOTIATED";
  const [accounts, successorLoanId] = await Promise.all([
    listAccounts(),
    closed ? findSuccessor(loan.id, today) : Promise.resolve(undefined),
  ]);
  return (
    <PaymentForm
      loan={loan}
      accounts={accounts.items}
      today={today}
      {...(successorLoanId === undefined ? {} : { successorLoanId })}
      onPreview={previewPaymentAction}
      onSubmit={createPaymentAction}
    />
  );
}
