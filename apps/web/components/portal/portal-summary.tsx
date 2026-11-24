import type { ReactElement } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { PortalLoanDetailResponse } from "@/lib/api/portal";
import { formatReais } from "@/lib/portal-format";
import { portalTexts } from "@/lib/portal-texts";

export function PortalSummary({ loan }: { loan: PortalLoanDetailResponse }): ReactElement {
  const t = portalTexts.detail.summary;
  const rows: readonly (readonly [string, number])[] = [
    [t.principal, loan.principalCents],
    [t.total, loan.totalCents],
    [t.paid, loan.paidCents],
    [t.outstanding, loan.outstandingCents],
  ];
  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          {rows.map(([label, cents]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold">{formatReais(cents)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
