import type { ReactElement } from "react";
import { NewLoanForm } from "@/components/loans/new-loan-form";
import { PageHeader } from "@/components/shared/page-header";
import { listPeople } from "@/lib/api/people";
import { getDefaultTerms } from "@/lib/api/settings";
import { createLoanAction } from "../actions";

/** Parâmetros padrão e pessoas vêm da API: nunca pré-renderizar no build. */
export const dynamic = "force-dynamic";

export default async function NovoContratoPage(): Promise<ReactElement> {
  const [defaults, { items }] = await Promise.all([getDefaultTerms(), listPeople({ limit: 100 })]);
  const people = items.filter((person) => person.active);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novo contrato" />
      <NewLoanForm people={people} defaults={defaults} onCreate={createLoanAction} />
    </div>
  );
}
