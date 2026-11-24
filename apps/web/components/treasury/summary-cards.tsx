import type { TreasurySummaryResponse } from "@pilla/schemas";
import type { ReactElement } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBps, formatMoney } from "./treasury-format";

export type SummaryCardsProps = { readonly summary: TreasurySummaryResponse };

type Indicator = { readonly label: string; readonly value: string; readonly hint?: string };

/** Indicadores do painel (RF-32, E12 D7): posição de agora e valores do mês escolhido. */
export function SummaryCards({ summary }: SummaryCardsProps): ReactElement {
  const indicators: readonly Indicator[] = [
    { label: "Caixa", value: formatMoney(summary.cashCents) },
    { label: "Emprestado", value: formatMoney(summary.lentCents) },
    {
      label: "Comprometido",
      value: formatBps(summary.committedBps),
      ...(summary.maxCommittedBps === null
        ? {}
        : { hint: `Limite de referência: ${formatBps(summary.maxCommittedBps)}` }),
    },
    { label: "Disponível", value: formatBps(summary.availableBps) },
    { label: "Juros recebidos no mês", value: formatMoney(summary.interestReceivedCents) },
    { label: "Encargos recebidos no mês", value: formatMoney(summary.lateChargesReceivedCents) },
    { label: "Recuperado no mês", value: formatMoney(summary.recoveredCents) },
    { label: "Perdas", value: formatMoney(summary.lossesCents) },
    { label: "Previsão do mês", value: formatMoney(summary.forecastCents) },
  ];
  return (
    <section aria-label="Painel da tesouraria" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {indicators.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-xl">{item.value}</CardTitle>
          </CardHeader>
          {item.hint && <CardContent className="text-sm text-muted-foreground">{item.hint}</CardContent>}
        </Card>
      ))}
    </section>
  );
}
