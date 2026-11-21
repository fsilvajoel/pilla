import type { ReactElement } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PagamentoLoading(): ReactElement {
  return (
    <div className="flex max-w-xl flex-col gap-3" role="status" aria-label="Carregando o formulário de pagamento">
      <Skeleton className="h-8 w-64" />
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}
