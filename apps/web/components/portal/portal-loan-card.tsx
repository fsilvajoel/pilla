import Link from "next/link";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalLoanListResponse } from "@/lib/api/portal";
import { formatDate, formatReais } from "@/lib/portal-format";
import { portalTexts } from "@/lib/portal-texts";
import { PortalSituationBadge } from "./portal-situation-badge";

type PortalLoanItem = PortalLoanListResponse["items"][number];

export function PortalLoanCard({ loan }: { loan: PortalLoanItem }): ReactElement {
  const t = portalTexts.list;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">{t.contract(loan.loanNumber)}</CardTitle>
        <PortalSituationBadge situation={loan.situation} />
      </CardHeader>
      <CardContent className="space-y-1 text-base">
        <p>{t.borrowed(formatReais(loan.principalCents))}</p>
        {loan.situation === "PAID_OFF" ? (
          <p>{t.paidOff}</p>
        ) : (
          <>
            <p>{t.outstanding(formatReais(loan.outstandingCents))}</p>
            {loan.nextDueDate !== null && <p>{t.nextDue(formatDate(loan.nextDueDate))}</p>}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full sm:w-auto">
          <Link href={`/portal/contratos/${loan.id}`}>{t.details}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
