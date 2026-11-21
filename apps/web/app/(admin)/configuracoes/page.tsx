import type { ReactElement } from "react";
import { DefaultTermsForm } from "@/components/settings/default-terms-form";
import { PageHeader } from "@/components/shared/page-header";
import { getDefaultTerms } from "@/lib/api/settings";
import { updateDefaultTermsAction } from "./actions";

/** Lê a API a cada pedido: os parâmetros vigentes mudam e não podem ser prerenderizados. */
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage(): Promise<ReactElement> {
  const terms = await getDefaultTerms();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Parâmetros padrão dos contratos" />
      <DefaultTermsForm terms={terms} onSave={updateDefaultTermsAction} />
    </div>
  );
}
