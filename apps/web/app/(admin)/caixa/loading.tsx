import type { ReactElement } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function CaixaLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Caixa" />
      <div className="flex flex-col gap-3" role="status" aria-label="Carregando o caixa">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
