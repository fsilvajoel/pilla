// Exceção que as features lançam para responder qualquer `code` do catálogo (RFC-004 §6).
import { HttpException } from "@nestjs/common";
import { errorStatus } from "@pilla/schemas";
import type { ErrorCode } from "@pilla/schemas";

export type ProblemFieldError = { readonly field: string; readonly message: string };

export class ProblemException extends HttpException {
  readonly code: ErrorCode;
  readonly detail: string;
  readonly errors: readonly ProblemFieldError[] | undefined;

  constructor(code: ErrorCode, detail: string, errors?: readonly ProblemFieldError[]) {
    super(detail, errorStatus[code]);
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}
