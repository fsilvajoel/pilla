import type { JSX } from "react";
import { PersonForm } from "@/components/person-form";
import { mockPeople } from "@/lib/mock-data";

// Casca de rota (decisões do Joel de 17/11): dados de mentira até a API existir.
export default function NewPersonPage(): JSX.Element {
  return (
    <main>
      <h1>Nova pessoa</h1>
      <PersonForm people={mockPeople} />
    </main>
  );
}
