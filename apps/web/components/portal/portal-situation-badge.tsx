import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import type { PortalSituation } from "@/lib/api/portal";
import { portalTexts } from "@/lib/portal-texts";

const variantBySituation = {
  CURRENT: "success",
  OVERDUE: "destructive",
  PAID_OFF: "secondary",
} as const satisfies Record<PortalSituation, "success" | "destructive" | "secondary">;

/** Situação em texto e cor (nunca só cor). */
export function PortalSituationBadge({ situation }: { situation: PortalSituation }): ReactElement {
  return (
    <Badge variant={variantBySituation[situation]} className="px-3 py-1 text-sm">
      {portalTexts.situation[situation]}
    </Badge>
  );
}
