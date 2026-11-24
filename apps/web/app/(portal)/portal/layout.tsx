import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactElement, ReactNode } from "react";
import { PortalHeader } from "@/components/portal/portal-header";
import { PORTAL_COOKIE } from "@/lib/api/portal";
import { portalTexts } from "@/lib/portal-texts";

export const metadata: Metadata = { title: portalTexts.appName };
export const dynamic = "force-dynamic";

/** Layout do portal (E15 D15): sem a navegação do ADMIN; o botão "Sair" só aparece com sessão. */
export default async function PortalLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const store = await cookies();
  const signedIn = store.has(PORTAL_COOKIE);
  return (
    <div className="min-h-screen bg-background">
      <PortalHeader signedIn={signedIn} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
