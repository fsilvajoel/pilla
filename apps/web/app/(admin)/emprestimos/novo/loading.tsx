import type { ReactElement } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function NovoContratoLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novo contrato" />
      <div className="flex max-w-xl flex-col gap-3" role="status" aria-label="Carregando formulário">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
