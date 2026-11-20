// stub E9-F02: substituído no E9-T03.
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";

export class ProblemDetailsFilter implements ExceptionFilter {
  catch(_exception: unknown, _host: ArgumentsHost): void {
    throw new Error("esboço: não implementado");
  }
}
