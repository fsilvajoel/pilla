import { notFound } from "next/navigation";
import type { JSX } from "react";
import { LoanDetail } from "@/components/loan-detail";
import { mockLoanDetails } from "@/lib/mock-data";

// Casca de rota (decisões do Joel de 17/11): dados de mentira até a API existir.
export default async function LoanPage({ params }: { readonly params: Promise<{ id: string }> }): Promise<JSX.Element> {
  const { id } = await params;
  const loan = mockLoanDetails.find((l) => l.id === id);
  if (loan === undefined) notFound();
  return (
    <main>
      <LoanDetail loan={loan} />
    </main>
  );
}
