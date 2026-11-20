import { Catch, HttpException, Inject, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { HttpAdapterHost, type AbstractHttpAdapter } from "@nestjs/core";
import { errorStatus, type ErrorCode, type Problem } from "@pilla/schemas";
import { inspect } from "node:util";
import { ProblemException, type ProblemFieldError } from "./problem-exception";

type Descriptor = { code: ErrorCode; detail: string; errors: readonly ProblemFieldError[] | undefined };

const titles: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: "Validação falhou",
  NOT_FOUND: "Não encontrado",
  INTERNAL_ERROR: "Erro interno",
};

function describeException(exception: unknown): Descriptor {
  if (exception instanceof ProblemException) {
    return { code: exception.code, detail: exception.detail, errors: exception.errors };
  }
  const status = exception instanceof HttpException ? exception.getStatus() : 500;
  if (status === 404) return { code: "NOT_FOUND", detail: "Recurso não encontrado.", errors: undefined };
  if (status === 400) return { code: "VALIDATION_FAILED", detail: "Dados inválidos.", errors: undefined };
  return { code: "INTERNAL_ERROR", detail: "Erro interno do servidor.", errors: undefined };
}

export function toProblem(exception: unknown): Problem {
  const { code, detail, errors } = describeException(exception);
  if (code === "INTERNAL_ERROR") Logger.error(inspect(exception));
  return {
    title: titles[code] ?? code,
    status: errorStatus[code],
    detail,
    code,
    ...(errors === undefined ? {} : { errors: [...errors] }),
  };
}

export function sendProblem(adapter: AbstractHttpAdapter, response: unknown, problem: Problem): void {
  adapter.setHeader(response, "Content-Type", "application/problem+json");
  adapter.reply(response, problem, problem.status);
}

// Toda resposta de erro é application/problem+json (RFC 9457, RFC-004 §6). O erro 500 vai só para o log.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly adapterHost: HttpAdapterHost;

  constructor(@Inject(HttpAdapterHost) adapterHost: HttpAdapterHost) {
    this.adapterHost = adapterHost;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const response: unknown = host.switchToHttp().getResponse();
    sendProblem(this.adapterHost.httpAdapter, response, toProblem(exception));
  }
}
