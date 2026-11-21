"use client";

import type { ReactElement } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export type AlertasErrorProps = { readonly error: Error; readonly reset: () => void };

export default function AlertasError({ reset }: AlertasErrorProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Alertas" />
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-destructive">Não foi possível carregar os alertas.</p>
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
