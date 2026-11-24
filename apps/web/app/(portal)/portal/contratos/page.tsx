import { FileTextIcon } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { PortalLoanCard } from "@/components/portal/portal-loan-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getPortalLoans, PORTAL_COOKIE, type PortalLoanListResponse } from "@/lib/api/portal";
import { ApiProblem } from "@/lib/api/problem";
import { portalTexts } from "@/lib/portal-texts";

export const dynamic = "force-dynamic";

export default async function PortalLoansPage(): Promise<ReactElement> {
  const store = await cookies();
  let list: PortalLoanListResponse;
  try {
    list = await getPortalLoans(store.get(PORTAL_COOKIE)?.value);
  } catch (error) {
    if (error instanceof ApiProblem && error.status === 401) redirect("/portal?sessao=vencida");
    throw error;
  }
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{portalTexts.list.title}</h1>
      {list.items.length === 0 ? (
        <EmptyState text={portalTexts.list.empty} icon={FileTextIcon} />
      ) : (
        <ul className="space-y-4">
          {list.items.map((loan) => (
            <li key={loan.id}>
              <PortalLoanCard loan={loan} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
