// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(readonly schema: ZodType<T>) {}
  transform(_value: unknown, _metadata: ArgumentMetadata): T {
    throw new Error("esboço: não implementado");
  }
}
