// Filtro global: toda exceção vira application/problem+json (RFC-004 §2 e §6).
import { Catch, HttpException, Inject, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { errorStatus } from "@pilla/schemas";
import type { ErrorCode, Problem } from "@pilla/schemas";
import { ProblemException } from "./problem-exception";

const standard: Readonly<
  Record<"VALIDATION_FAILED" | "NOT_FOUND" | "INTERNAL_ERROR", { title: string; detail: string }>
> = {
  VALIDATION_FAILED: { title: "Validação falhou", detail: "Dados inválidos." },
  NOT_FOUND: { title: "Não encontrado", detail: "Recurso não encontrado." },
  INTERNAL_ERROR: { title: "Erro interno", detail: "Erro interno do servidor." },
};

function standardProblem(code: keyof typeof standard): Problem {
  return { ...standard[code], status: errorStatus[code], code };
}

function toProblem(exception: unknown, logger: Logger): Problem {
  if (exception instanceof ProblemException) {
    const code: ErrorCode = exception.code;
    const title =
      code === "VALIDATION_FAILED"
        ? standard.VALIDATION_FAILED.title
        : code === "NOT_FOUND"
          ? standard.NOT_FOUND.title
          : code;
    const problem: Problem = { title, status: errorStatus[code], detail: exception.detail, code };
    return exception.errors === undefined ? problem : { ...problem, errors: [...exception.errors] };
  }
  if (exception instanceof HttpException) {
    if (exception.getStatus() === 404) return standardProblem("NOT_FOUND");
    if (exception.getStatus() === 400) return standardProblem("VALIDATION_FAILED");
  }
  // Mensagem e stack só no log do servidor; nunca no corpo.
  const message = exception instanceof Error ? exception.message : String(exception);
  logger.error(message, exception instanceof Error ? exception.stack : undefined);
  return standardProblem("INTERNAL_ERROR");
}

/** Escreve o problema na resposta; usado pelo filtro e pelo 404 fora do prefixo. */
export function replyProblem(adapterHost: HttpAdapterHost, response: unknown, problem: Problem): void {
  const adapter = adapterHost.httpAdapter;
  adapter.setHeader(response, "Content-Type", "application/problem+json; charset=utf-8");
  adapter.reply(response, problem, problem.status);
}

/** 404 padrão (RFC-004 §6). */
export function notFoundProblem(): Problem {
  return standardProblem("NOT_FOUND");
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = toProblem(exception, this.logger);
    replyProblem(this.adapterHost, host.switchToHttp().getResponse(), problem);
  }
}
