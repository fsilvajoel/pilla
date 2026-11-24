import { cpfSchema, idSchema, isoDateSchema, loanNumberSchema, type PortalSessionRequest } from "@pilla/schemas";
import { z } from "zod";
import { ApiProblem, parseProblem } from "./problem";

// Só roda no servidor (ADR-0013), como o resto de lib/api.
if (typeof window !== "undefined") {
  throw new Error("lib/api/portal só pode ser usado no servidor");
}

/** Cookie da sessão do portal (E15 D6). A API o emite com Path=/api/v1/portal; a web o regrava para as rotas /portal. */
export const PORTAL_COOKIE = "pilla_portal";
/** Teto absoluto da sessão (E15 D6): 2 horas, usado quando a API não manda Max-Age. */
const DEFAULT_MAX_AGE_SECONDS = 7200;

// LACUNA: os schemas de resposta do portal (E15-T01, `portal-loans.ts`) ainda não estão em @pilla/schemas neste branch.
// Estes espelham E15.md D2 e devem ser trocados pelos do pacote quando o E15-T01 entrar.
export const portalSituationSchema = z.enum(["CURRENT", "OVERDUE", "PAID_OFF"]);
export type PortalSituation = z.infer<typeof portalSituationSchema>;

export const portalLoanListResponse = z.strictObject({
  items: z.array(
    z.strictObject({
      id: idSchema,
      loanNumber: loanNumberSchema,
      principalCents: z.int().nonnegative(),
      outstandingCents: z.int().nonnegative(),
      situation: portalSituationSchema,
      nextDueDate: isoDateSchema.nullable(),
    }),
  ),
});
export type PortalLoanListResponse = z.infer<typeof portalLoanListResponse>;

export const portalInstallmentStatusSchema = z.enum(["OPEN", "PARTIAL", "PAID", "OVERDUE", "OVERDUE_PARTIAL"]);
export type PortalInstallmentStatus = z.infer<typeof portalInstallmentStatusSchema>;

export const portalPaymentMethodSchema = z.enum(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"]);
export type PortalPaymentMethod = z.infer<typeof portalPaymentMethodSchema>;

export const portalLoanDetailResponse = z.strictObject({
  id: idSchema,
  loanNumber: loanNumberSchema,
  situation: portalSituationSchema,
  principalCents: z.int().nonnegative(),
  totalCents: z.int().nonnegative(),
  paidCents: z.int().nonnegative(),
  outstandingCents: z.int().nonnegative(),
  lateChargesCents: z.int().nonnegative(),
  nextInstallment: z
    .strictObject({
      number: z.int().positive(),
      dueDate: isoDateSchema,
      amountCents: z.int().nonnegative(),
    })
    .nullable(),
  installments: z.array(
    z.strictObject({
      number: z.int().positive(),
      dueDate: isoDateSchema,
      amountCents: z.int().nonnegative(),
      paidCents: z.int().nonnegative(),
      lateChargesCents: z.int().nonnegative(),
      status: portalInstallmentStatusSchema,
    }),
  ),
  payments: z.array(
    z.strictObject({
      paidAt: z.union([isoDateSchema, z.iso.datetime({ offset: true })]),
      amountCents: z.int().nonnegative(),
      method: portalPaymentMethodSchema,
    }),
  ),
});
export type PortalLoanDetailResponse = z.infer<typeof portalLoanDetailResponse>;

function baseUrl(): string {
  const url = process.env.PILLA_API_URL;
  if (!url) throw new Error("PILLA_API_URL não definida");
  return url.replace(/\/+$/, "");
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

interface PortalRequest<T> {
  method?: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  /** Token da sessão (valor do cookie `pilla_portal`), repassado à API no cabeçalho Cookie. */
  token?: string | undefined;
  schema?: z.ZodType<T>;
}

interface PortalResponse<T> {
  data: T;
  setCookies: readonly string[];
}

/** Como `apiFetch`, mas repassa o cookie do portal e devolve os `Set-Cookie` (a entrada precisa deles). */
async function portalFetch<T>(req: PortalRequest<T>): Promise<PortalResponse<T | null>> {
  const res = await fetch(`${baseUrl()}${req.path}`, {
    method: req.method ?? "GET",
    headers: {
      accept: "application/json, application/problem+json",
      ...(req.token === undefined ? {} : { cookie: `${PORTAL_COOKIE}=${req.token}` }),
      ...(req.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: req.body === undefined ? null : JSON.stringify(req.body),
    cache: "no-store",
  });
  const json = await readJson(res);
  if (!res.ok) throw parseProblem(res.status, json);
  const setCookies = res.headers.getSetCookie();
  if (req.schema === undefined) return { data: null, setCookies };
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) throw new ApiProblem(res.status, null);
  return { data: parsed.data, setCookies };
}

export interface PortalSessionCookie {
  token: string;
  maxAgeSeconds: number;
}

/** Acha o cookie do portal entre os `Set-Cookie` da API; nulo se não veio. */
export function parsePortalSetCookie(setCookies: readonly string[]): PortalSessionCookie | null {
  for (const header of setCookies) {
    const [pair = "", ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (pair.slice(0, separator) !== PORTAL_COOKIE) continue;
    const token = pair.slice(separator + 1);
    if (token === "") continue;
    const maxAge = attributes
      .map((attribute) => /^max-age=(\d+)$/i.exec(attribute)?.[1])
      .find((value): value is string => value !== undefined);
    return { token, maxAgeSeconds: maxAge === undefined ? DEFAULT_MAX_AGE_SECONDS : Number(maxAge) };
  }
  return null;
}

/** POST /portal/session: só o CPF; devolve o cookie emitido pela API (204 sem corpo). */
export async function createPortalSession(cpf: string): Promise<PortalSessionCookie> {
  const body: PortalSessionRequest = { cpf: cpfSchema.parse(cpf) };
  const { setCookies } = await portalFetch({ method: "POST", path: "/portal/session", body });
  const cookie = parsePortalSetCookie(setCookies);
  if (cookie === null) throw new ApiProblem(500, null);
  return cookie;
}

/** DELETE /portal/session: idempotente, 204 mesmo sem sessão. */
export async function deletePortalSession(token: string | undefined): Promise<void> {
  await portalFetch({ method: "DELETE", path: "/portal/session", token });
}

/** GET /portal/loans: contratos da pessoa da sessão (RF-61). 401 chega como `ApiProblem`. */
export async function getPortalLoans(token: string | undefined): Promise<PortalLoanListResponse> {
  const { data } = await portalFetch({ path: "/portal/loans", token, schema: portalLoanListResponse });
  if (data === null) throw new ApiProblem(500, null);
  return data;
}

/** GET /portal/loans/{id}: detalhe de um contrato da pessoa da sessão (RF-62). 404 vale para "não é seu" também. */
export async function getPortalLoan(token: string | undefined, id: string): Promise<PortalLoanDetailResponse> {
  const { data } = await portalFetch({
    path: `/portal/loans/${encodeURIComponent(id)}`,
    token,
    schema: portalLoanDetailResponse,
  });
  if (data === null) throw new ApiProblem(500, null);
  return data;
}
