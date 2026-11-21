import type { PayoffQuoteResponse } from "@pilla/schemas";
import type { ReactElement } from "react";
import { cents, formatReais } from "@pilla/finance";
import { formatDateBr } from "./loan-actions";

const money = (value: number): string => `R$ ${formatReais(cents(BigInt(value)))}`;

/** Total da quitação na data e os três componentes (RN-C08). */
export function PayoffQuoteView({ quote }: { readonly quote: PayoffQuoteResponse }): ReactElement {
  const items = [
    { label: "Principal em aberto", value: quote.principalCents },
    { label: "Juros em aberto", value: quote.interestCents },
    { label: "Encargos por atraso", value: quote.lateChargesCents },
  ] as const;
  return (
    <section className="flex max-w-xl flex-col gap-4" aria-label="Cotação de quitação">
      <p className="text-sm text-muted-foreground">Valores em {formatDateBr(quote.date)}.</p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">Total para quitar</dt>
          <dd className="text-lg font-semibold">{money(quote.amountCents)}</dd>
        </div>
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="font-medium">{money(item.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">A quitação é feita registrando um pagamento no valor do total.</p>
    </section>
  );
}
