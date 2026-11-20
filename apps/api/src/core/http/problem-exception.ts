import { HttpException } from "@nestjs/common";
import { errorStatus, type ErrorCode } from "@pilla/schemas";

export type ProblemFieldError = { readonly field: string; readonly message: string };

// Erro de negócio ou de entrada com `code` do catálogo (RFC-004 §6); o filtro o vira application/problem+json.
export class ProblemException extends HttpException {
  readonly code: ErrorCode;
  readonly detail: string;
  readonly errors: readonly ProblemFieldError[] | undefined;

  constructor(code: ErrorCode, detail: string, errors?: readonly ProblemFieldError[]) {
    super({ code, detail }, errorStatus[code]);
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}
