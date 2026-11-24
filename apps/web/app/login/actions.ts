"use server";

import { adminLoginRequest } from "@pilla/schemas";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/lib/api/auth";
import { ApiProblem } from "@/lib/api/problem";
import { safeNextPath, writeSessionToken } from "@/lib/api/session";

export interface LoginState {
  error: string | null;
}

const INVALID = "Usuário ou senha inválidos.";
const THROTTLED = "Muitas tentativas. Aguarde um minuto.";
const UNAVAILABLE = "Não foi possível entrar agora. Tente novamente.";

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(_previous: LoginState, data: FormData): Promise<LoginState> {
  const parsed = adminLoginRequest.safeParse({ username: text(data, "username"), password: text(data, "password") });
  if (!parsed.success) return { error: INVALID };
  try {
    const { token } = await loginAdmin(parsed.data);
    await writeSessionToken(token);
  } catch (error) {
    if (error instanceof ApiProblem) {
      if (error.status === 401) return { error: INVALID };
      if (error.status === 429) return { error: THROTTLED };
    }
    return { error: UNAVAILABLE };
  }
  redirect(safeNextPath(text(data, "next")));
}
