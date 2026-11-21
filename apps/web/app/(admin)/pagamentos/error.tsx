"use client";

import type { ReactElement } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function PagamentosError({
  reset,
}: {
  readonly error: Error;
  readonly reset: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pagamentos" />
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-destructive">Não foi possível carregar os pagamentos.</p>
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
