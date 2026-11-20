import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { ProblemException, type ProblemFieldError } from "./problem-exception";

// Validação Zod só na borda HTTP (D1); uso: @Body(new ZodValidationPipe(schema)).
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  private readonly schema: ZodType<T>;

  constructor(schema: ZodType<T>) {
    this.schema = schema;
  }

  transform(value: unknown, metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    // Um item por campo: vale o primeiro problema de cada caminho; problema na raiz usa o tipo do parâmetro.
    const errors: ProblemFieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.length === 0 ? metadata.type : issue.path.map(String).join("."),
      message: issue.message,
    }));
    const unique = errors.filter((error, index) => errors.findIndex((other) => other.field === error.field) === index);
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", unique);
  }
}
