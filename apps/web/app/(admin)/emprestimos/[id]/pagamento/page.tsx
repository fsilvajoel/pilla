import { notFound } from "next/navigation";
import type { JSX } from "react";
import { PaymentForm } from "@/components/payment-form";
import { mockAccounts, mockLoanDetails } from "@/lib/mock-data";

// Casca de rota (decisões do Joel de 17/11): pagamento a partir do detalhe, com dados de mentira.
export default async function PaymentPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const loan = mockLoanDetails.find((l) => l.id === id && l.status === "ACTIVE");
  if (loan === undefined) notFound();
  return (
    <main>
      <PaymentForm loan={loan} accounts={mockAccounts} />
    </main>
  );
}
