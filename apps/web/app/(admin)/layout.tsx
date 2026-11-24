import type { ReactElement, ReactNode } from "react";
import { authEnforced } from "@/lib/auth-enforced";
import { AdminShell } from "@/components/shared/admin-shell";
import { getMe } from "@/lib/api/auth";
import { ApiProblem } from "@/lib/api/problem";
import { currentPath, redirectToLogin } from "@/lib/api/session";

// Toda rota do admin depende da sessão: nada é pré-renderizado.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const admin = await getMe().catch(async (error: unknown) => {
    if (error instanceof ApiProblem && error.status === 401) {
      // Autenticação desligada (só desenvolvimento): segue sem login, sem nome de usuário.
      if (!authEnforced()) return { id: "", username: "dev", role: "ADMIN" as const };
      redirectToLogin(await currentPath());
    }
    throw error;
  });
  return <AdminShell username={admin.username}>{children}</AdminShell>;
}
