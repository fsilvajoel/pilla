"use server";

import { cpfSchema } from "@pilla/schemas";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieSecure } from "@/lib/api/cookie-secure";
import { createPortalSession, deletePortalSession, PORTAL_COOKIE } from "@/lib/api/portal";
import { ApiProblem } from "@/lib/api/problem";
import { stripCpfPunctuation } from "@/lib/portal-format";
import { portalTexts } from "@/lib/portal-texts";

export interface EnterState {
  /** Texto de erro pronto para a tela; o CPF digitado nunca volta aqui. */
  error: string | null;
}

/** Entrada por CPF (RF-61): chama POST /portal/session e grava o cookie `pilla_portal` no navegador. */
export async function enterAction(_previous: EnterState, formData: FormData): Promise<EnterState> {
  const raw = formData.get("cpf");
  const cpf = stripCpfPunctuation(typeof raw === "string" ? raw : "");
  if (!cpfSchema.safeParse(cpf).success) return { error: portalTexts.entry.invalidCpf };

  try {
    const session = await createPortalSession(cpf);
    const store = await cookies();
    store.set(PORTAL_COOKIE, session.token, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      // A API usa Path=/api/v1/portal; o navegador só fala com o Next, então o cookie vale para as rotas /portal.
      path: "/portal",
      maxAge: session.maxAgeSeconds,
    });
  } catch (error) {
    if (error instanceof ApiProblem && error.status === 401) return { error: portalTexts.entry.unauthorized };
    if (error instanceof ApiProblem && error.status === 429) return { error: portalTexts.entry.tooManyAttempts };
    if (error instanceof ApiProblem && error.status === 400) return { error: portalTexts.entry.invalidCpf };
    return { error: portalTexts.entry.unexpected };
  }
  redirect("/portal/contratos");
}

/** "Sair": apaga a sessão na API e o cookie no navegador (idempotente). */
export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE)?.value;
  try {
    await deletePortalSession(token);
  } catch {
    // A saída não pode travar: o cookie sai do navegador de qualquer jeito e a sessão vence sozinha (D6).
  }
  store.delete({ name: PORTAL_COOKIE, path: "/portal" });
  redirect("/portal");
}
