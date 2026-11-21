"use client";

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";

export default function PagamentoError({ reset }: { readonly error: Error; readonly reset: () => void }): ReactElement {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-destructive">Não foi possível carregar o formulário de pagamento.</p>
      <Button variant="outline" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
