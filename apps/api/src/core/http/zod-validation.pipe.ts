// Pipe de validação Zod, usado por parâmetro (`@Body(new ZodValidationPipe(schema))`), só na borda HTTP.
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { ProblemException } from "./problem-exception";
import type { ProblemFieldError } from "./problem-exception";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(readonly schema: ZodType<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    // Um item por campo: o primeiro problema de cada caminho; problema na raiz usa o tipo do parâmetro.
    const byField = new Map<string, ProblemFieldError>();
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? issue.path.map(String).join(".") : metadata.type;
      if (!byField.has(field)) byField.set(field, { field, message: issue.message });
    }
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [...byField.values()]);
  }
}
