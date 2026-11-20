// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import { HttpException } from "@nestjs/common";
import type { ErrorCode } from "@pilla/schemas";
export type ProblemFieldError = { readonly field: string; readonly message: string };
export class ProblemException extends HttpException {
  readonly code: ErrorCode;
  readonly detail: string;
  readonly errors: readonly ProblemFieldError[] | undefined;
  constructor(_code: ErrorCode, _detail: string, _errors?: readonly ProblemFieldError[]) {
    super("esboço", 500);
    throw new Error("esboço: não implementado");
  }
}
