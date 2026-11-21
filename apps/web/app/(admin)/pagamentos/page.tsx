import { idSchema, paymentStatusSchema, type PaymentStatus } from "@pilla/schemas";
import type { ReactElement } from "react";
import Link from "next/link";
import { PaymentFilters } from "@/components/payments/payment-filters";
import { PaymentsTable } from "@/components/payments/payments-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listPayments, type ListPaymentsParams } from "@/lib/api/payments";
import { confirmPaymentAction, rejectPaymentAction, reversePaymentAction } from "./actions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? "";
}

/** Fila de conferência (RF-20 a RF-22): pendentes por padrão; filtros e cursor ficam na URL. */
export default async function PagamentosPage({ searchParams }: PageProps): Promise<ReactElement> {
  const raw = await searchParams;
  const parsedStatus = paymentStatusSchema.safeParse(first(raw.status));
  const status: PaymentStatus = parsedStatus.success ? parsedStatus.data : "PENDING_REVIEW";
  const parsedLoan = idSchema.safeParse(first(raw.loanId));
  const loanId = parsedLoan.success ? parsedLoan.data : undefined;
  const cursor = first(raw.cursor);

  const params: ListPaymentsParams = { status };
  if (loanId !== undefined) params.loanId = loanId;
  if (cursor) params.cursor = cursor;
  const { items, nextCursor } = await listPayments(params);

  const next = new URLSearchParams({ status });
  if (loanId !== undefined) next.set("loanId", loanId);
  if (nextCursor) next.set("cursor", nextCursor);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pagamentos" />
      <PaymentFilters status={status} {...(loanId === undefined ? {} : { loanId })} />
      <PaymentsTable
        payments={items}
        onConfirm={confirmPaymentAction}
        onReject={rejectPaymentAction}
        onReverse={reversePaymentAction}
      />
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href={`/pagamentos?${next.toString()}`}>Carregar mais</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
