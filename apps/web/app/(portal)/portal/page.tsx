import type { ReactElement } from "react";
import { CpfForm } from "@/components/portal/cpf-form";
import { portalTexts } from "@/lib/portal-texts";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ sessao?: string | string[] }>;
}

export default async function PortalEntryPage({ searchParams }: PageProps): Promise<ReactElement> {
  const { sessao } = await searchParams;
  const expired = sessao === "vencida";
  return <CpfForm notice={expired ? portalTexts.entry.sessionExpired : null} />;
}
