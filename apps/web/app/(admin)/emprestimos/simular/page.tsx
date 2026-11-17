import { connection } from "next/server";
import type { JSX } from "react";
import { LoanSimulation } from "@/components/loan-simulation";
import { todayInBrt } from "@/lib/today";

// Casca de rota: o desembolso da simulação é hoje em Brasília (decisões do Joel de 17/11). `connection()` deixa
// a página dinâmica, para "hoje" ser o dia do pedido e não o do build.
export default async function SimulateLoanPage(): Promise<JSX.Element> {
  await connection();
  return (
    <main>
      <h1>Simular empréstimo</h1>
      <LoanSimulation disbursementDate={todayInBrt(new Date())} />
    </main>
  );
}
