import type { JSX } from "react";
import { LoanList } from "@/components/loan-list";
import { mockLoanList } from "@/lib/mock-data";

// Casca de rota (decisões do Joel de 17/11): dados de mentira até a API existir.
export default function LoansPage(): JSX.Element {
  return (
    <main>
      <h1>Contratos</h1>
      <LoanList loans={mockLoanList} />
    </main>
  );
}
