import type { ReactElement } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConfiguracoesLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" />
      <div className="flex max-w-xl flex-col gap-4" role="status" aria-label="Carregando configurações">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
