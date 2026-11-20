// stub E9-F02: substituído no E9-T03.
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  readonly schema: ZodType<T>;

  constructor(schema: ZodType<T>) {
    this.schema = schema;
  }

  transform(_value: unknown, _metadata: ArgumentMetadata): T {
    throw new Error("esboço: não implementado");
  }
}
