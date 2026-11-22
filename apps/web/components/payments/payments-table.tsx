"use client";

import type { PaymentListItem } from "@pilla/schemas";
import type { ReactElement } from "react";
import { cents, formatReais } from "@pilla/finance";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDateBr } from "@/components/loans/loan-actions";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/labels";
import type { PaymentRecordResult } from "./payment-actions";
import { ReasonDialog } from "./reason-dialog";

export type PaymentsTableProps = {
  readonly payments: readonly PaymentListItem[];
  readonly onConfirm: (id: string, version: number) => Promise<PaymentRecordResult>;
  readonly onReject: (id: string, version: number, input: unknown) => Promise<PaymentRecordResult>;
  readonly onReverse: (id: string, version: number, input: unknown) => Promise<PaymentRecordResult>;
};

type Reasoning = { readonly kind: "reject" | "reverse"; readonly payment: PaymentListItem };

const money = (value: number): string => `R$ ${formatReais(cents(BigInt(value)))}`;

/** Fila de conferência: Confirmar e Rejeitar nos pendentes, Estornar nos confirmados (RF-20 a RF-22). */
export function PaymentsTable({ payments, onConfirm, onReject, onReverse }: PaymentsTableProps): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ readonly id: string; readonly message: string } | null>(null);
  const [reasoning, setReasoning] = useState<Reasoning | null>(null);

  function finish(id: string, result: PaymentRecordResult, success: string): boolean {
    if (result.ok) {
      setError(null);
      toast.success(success);
      router.refresh();
      return true;
    }
    setError({ id, message: result.message });
    return false;
  }

  function confirm(payment: PaymentListItem): void {
    setError(null);
    startTransition(async () => {
      finish(payment.id, await onConfirm(payment.id, payment.version), "Pagamento confirmado.");
    });
  }

  const columns: readonly DataTableColumn<PaymentListItem>[] = [
    {
      key: "loan",
      header: "Contrato",
      cell: (p) => (
        <Link href={`/emprestimos/${p.loanId}`} className="underline">
          {p.loanNumber}
        </Link>
      ),
    },
    { key: "person", header: "Pessoa", cell: (p) => p.personName },
    { key: "paidAt", header: "Data", cell: (p) => formatDateBr(p.paidAt) },
    { key: "amount", header: "Valor", cell: (p) => money(p.amountCents) },
    { key: "method", header: "Método", cell: (p) => paymentMethodLabel[p.method] },
    {
      key: "status",
      header: "Situação",
      cell: (p) => (
        <Badge
          variant={
            p.status === "CONFIRMED"
              ? "success"
              : p.status === "PENDING_REVIEW"
                ? "warning"
                : p.status === "REJECTED"
                  ? "destructive"
                  : "secondary"
          }
        >
          {paymentStatusLabel[p.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      cell: (p) => (
        <div className="flex flex-col items-start gap-1">
          <div className="flex gap-2">
            {p.status === "PENDING_REVIEW" && (
              <>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    confirm(p);
                  }}
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setReasoning({ kind: "reject", payment: p });
                  }}
                >
                  Rejeitar
                </Button>
              </>
            )}
            {p.status === "CONFIRMED" && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setReasoning({ kind: "reverse", payment: p });
                }}
              >
                Estornar
              </Button>
            )}
          </div>
          {error?.id === p.id && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}
        </div>
      ),
    },
  ];

  const target = reasoning?.payment;
  return (
    <>
      <DataTable columns={columns} rows={payments} getRowKey={(p) => p.id} emptyText="Nenhum pagamento." />
      <ReasonDialog
        open={reasoning !== null}
        onOpenChange={(open) => {
          if (!open) setReasoning(null);
        }}
        title={reasoning?.kind === "reverse" ? "Estornar pagamento" : "Rejeitar pagamento"}
        description={
          target === undefined ? "" : `Contrato ${target.loanNumber}, ${money(target.amountCents)}. Informe o motivo.`
        }
        confirmLabel={reasoning?.kind === "reverse" ? "Estornar" : "Rejeitar"}
        onSubmit={async (reason) => {
          if (reasoning === null) return null;
          const { kind, payment } = reasoning;
          const result =
            kind === "reverse"
              ? await onReverse(payment.id, payment.version, { reason })
              : await onReject(payment.id, payment.version, { reason });
          const ok = finish(payment.id, result, kind === "reverse" ? "Pagamento estornado." : "Pagamento rejeitado.");
          if (ok) {
            setReasoning(null);
            return null;
          }
          return result.ok ? null : result.message;
        }}
      />
    </>
  );
}
