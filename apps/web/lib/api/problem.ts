import { problemSchema, type ErrorCode, type Problem } from "@pilla/schemas";

export type FieldError = NonNullable<Problem["errors"]>[number];

/** Erro tipado da API (problem+json, RFC-004 §6). `code` é nulo quando a resposta não é um problem válido. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly fieldErrors: readonly FieldError[];
  /** contrato sucessor, só em LOAN_CLOSED_FOR_PAYMENTS (RN-R09) */
  readonly successorLoanId: string | null;

  constructor(status: number, problem: Problem | null) {
    super(problem?.detail ?? `Falha na API (HTTP ${String(status)})`);
    this.name = "ApiProblem";
    this.status = status;
    this.code = problem?.code ?? null;
    this.fieldErrors = problem?.errors ?? [];
    this.successorLoanId = problem?.successorLoanId ?? null;
  }

  /** Mensagens por campo, prontas para o formulário. */
  fieldMessages(): Record<string, string> {
    return Object.fromEntries(this.fieldErrors.map((e) => [e.field, e.message]));
  }
}

export function parseProblem(status: number, body: unknown): ApiProblem {
  const parsed = problemSchema.safeParse(body);
  return new ApiProblem(status, parsed.success ? parsed.data : null);
}
