import Link from "next/link";
import type { ReactElement } from "react";
import { portalTexts } from "@/lib/portal-texts";

export default function PortalLoanNotFound(): ReactElement {
  return (
    <div className="space-y-4">
      <p className="text-lg">{portalTexts.detail.notFound}</p>
      <Link href="/portal/contratos" className="text-base underline underline-offset-4">
        {portalTexts.detail.back}
      </Link>
    </div>
  );
}
