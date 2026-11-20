import type { z } from "zod";
import { ApiProblem, parseProblem } from "./problem";

// Só roda no servidor (ADR-0013): o navegador nunca chama a API. O pacote `server-only` não está na lista de
// dependências permitidas, então a trava é esta checagem em tempo de execução.
if (typeof window !== "undefined") {
  throw new Error("lib/api/client só pode ser usado no servidor");
}

function baseUrl(): string {
  const url = process.env.PILLA_API_URL;
  if (!url) throw new Error("PILLA_API_URL não definida");
  return url.replace(/\/+$/, "");
}

export type QueryValue = string | number | undefined;

export interface ApiRequest<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Schema Zod da resposta de sucesso (de @pilla/schemas). */
  schema: z.ZodType<T>;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text === "") return null;
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}

/** Chama a API, valida a resposta com o schema e converte problem+json em `ApiProblem`. */
export async function apiFetch<T>(req: ApiRequest<T>): Promise<T> {
  const url = new URL(`${baseUrl()}${req.path}`);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    method: req.method ?? "GET",
    headers: {
      accept: "application/json, application/problem+json",
      ...(req.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: req.body === undefined ? null : JSON.stringify(req.body),
    cache: "no-store",
  });
  const json = await readJson(res);
  if (!res.ok) throw parseProblem(res.status, json);
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) throw new ApiProblem(res.status, null);
  return parsed.data;
}
