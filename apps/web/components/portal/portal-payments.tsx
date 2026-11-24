import type { ReactElement } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortalLoanDetailResponse } from "@/lib/api/portal";
import { formatDate, formatReais } from "@/lib/portal-format";
import { portalTexts } from "@/lib/portal-texts";

type Payment = PortalLoanDetailResponse["payments"][number];

export function PortalPayments({ payments }: { payments: readonly Payment[] }): ReactElement {
  const t = portalTexts.detail.payments;
  return (
    <section className="space-y-3" aria-labelledby="portal-payments-title">
      <h2 id="portal-payments-title" className="text-xl font-semibold">
        {t.title}
      </h2>
      {payments.length === 0 ? (
        <p className="text-base text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.amount}</TableHead>
                <TableHead>{t.method}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment, index) => (
                <TableRow key={`${payment.paidAt}-${String(index)}`}>
                  <TableCell>{formatDate(payment.paidAt.slice(0, 10))}</TableCell>
                  <TableCell>{formatReais(payment.amountCents)}</TableCell>
                  <TableCell>{portalTexts.detail.method[payment.method]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
