import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortalInstallmentStatus, PortalLoanDetailResponse } from "@/lib/api/portal";
import { formatDate, formatReais } from "@/lib/portal-format";
import { portalTexts } from "@/lib/portal-texts";

type Installment = PortalLoanDetailResponse["installments"][number];

const variantByStatus = {
  PAID: "success",
  OPEN: "outline",
  PARTIAL: "warning",
  OVERDUE: "destructive",
  OVERDUE_PARTIAL: "destructive",
} as const satisfies Record<PortalInstallmentStatus, "success" | "outline" | "warning" | "destructive">;

function StatusBadge({ status }: { status: PortalInstallmentStatus }): ReactElement {
  return <Badge variant={variantByStatus[status]}>{portalTexts.detail.installmentStatus[status]}</Badge>;
}

/** Tabela a partir de sm; no celular (360 px) cada parcela vira um bloco empilhado. */
export function PortalInstallments({ installments }: { installments: readonly Installment[] }): ReactElement {
  const t = portalTexts.detail.installments;
  return (
    <section className="space-y-3" aria-labelledby="portal-installments-title">
      <h2 id="portal-installments-title" className="text-xl font-semibold">
        {t.title}
      </h2>
      <ul className="space-y-3 sm:hidden">
        {installments.map((item) => (
          <li key={item.number} className="space-y-1 rounded-lg border p-4">
            <p className="flex items-center justify-between gap-2 font-medium">
              <span>
                {t.number} {item.number}
              </span>
              <StatusBadge status={item.status} />
            </p>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-base">
              <dt className="text-muted-foreground">{t.dueDate}</dt>
              <dd>{formatDate(item.dueDate)}</dd>
              <dt className="text-muted-foreground">{t.amount}</dt>
              <dd>{formatReais(item.amountCents)}</dd>
              <dt className="text-muted-foreground">{t.paid}</dt>
              <dd>{formatReais(item.paidCents)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.number}</TableHead>
              <TableHead>{t.dueDate}</TableHead>
              <TableHead>{t.amount}</TableHead>
              <TableHead>{t.paid}</TableHead>
              <TableHead>{t.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((item) => (
              <TableRow key={item.number}>
                <TableCell>{item.number}</TableCell>
                <TableCell>{formatDate(item.dueDate)}</TableCell>
                <TableCell>{formatReais(item.amountCents)}</TableCell>
                <TableCell>{formatReais(item.paidCents)}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
