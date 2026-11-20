import type { JSX } from "react";
import { NewLoanForm } from "@/components/new-loan-form";
import { mockDefaultTerms, mockPeople } from "@/lib/mock-data";

// Casca de rota (decisões do Joel de 17/11): dados de mentira até a API existir.
export default function NewLoanPage(): JSX.Element {
  return (
    <main>
      <h1>Novo contrato</h1>
      <NewLoanForm people={mockPeople} defaults={mockDefaultTerms} />
    </main>
  );
}
