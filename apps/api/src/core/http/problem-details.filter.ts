// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import { Catch, Inject } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(@Inject(HttpAdapterHost) _adapterHost: HttpAdapterHost) {}
  catch(_exception: unknown, _host: ArgumentsHost): void {
    throw new Error("esboço: não implementado");
  }
}
