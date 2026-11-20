import type { ReactElement } from "react";
import Link from "next/link";
import { LoanFilters } from "@/components/loans/loan-filters";
import { parseLoanFilters } from "@/components/loans/loan-actions";
import { LoansTable } from "@/components/loans/loans-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listLoans, type ListLoansParams } from "@/lib/api/loans";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? "";
}

export default async function EmprestimosPage({ searchParams }: PageProps): Promise<ReactElement> {
  const raw = await searchParams;
  const filters = parseLoanFilters({ status: first(raw.status), standing: first(raw.standing) });
  const cursor = first(raw.cursor);
  const params: ListLoansParams = { ...filters };
  if (cursor) params.cursor = cursor;
  const { items, nextCursor } = await listLoans(params);

  const next = new URLSearchParams();
  if (filters.status) next.set("status", filters.status);
  if (filters.standing) next.set("standing", filters.standing);
  if (nextCursor) next.set("cursor", nextCursor);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contratos"
        actions={
          <Button asChild>
            <Link href="/emprestimos/novo">Novo contrato</Link>
          </Button>
        }
      />
      <LoanFilters {...filters} />
      <LoansTable loans={items} />
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href={`/emprestimos?${next.toString()}`}>Carregar mais</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
