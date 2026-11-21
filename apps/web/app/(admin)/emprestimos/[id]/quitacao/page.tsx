import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { canRollover } from "@/components/loans/loan-actions";
import { PayoffQuoteView } from "@/components/loans/payoff-quote-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoan, getPayoffQuote } from "@/lib/api/loans";
import { ApiProblem } from "@/lib/api/problem";
import { todayInBrt } from "@/lib/today";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cotação por GET: a data vem em `?date=` (padrão hoje) e o formulário recarrega a própria página. */
export default async function QuitacaoPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ date?: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const { date: rawDate } = await searchParams;
  const today = todayInBrt(new Date());
  const date = rawDate !== undefined && ISO_DATE.test(rawDate) ? rawDate : today;
  const loan = await getLoan(id).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status === 404) notFound();
    throw error;
  });
  if (!canRollover(loan.status)) notFound();
  const quote = await getPayoffQuote(id, date).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.status >= 400 && error.status < 500) return error;
    throw error;
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Cotação de quitação do contrato ${loan.loanNumber}`} description={loan.personName} />
      <form method="get" className="flex max-w-xl items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input id="date" name="date" type="date" defaultValue={date} />
        </div>
        <Button type="submit">Cotar</Button>
      </form>
      {quote instanceof ApiProblem ? (
        <p role="alert" className="text-sm text-destructive">
          {quote.message}
        </p>
      ) : (
        <PayoffQuoteView quote={quote} />
      )}
    </div>
  );
}
