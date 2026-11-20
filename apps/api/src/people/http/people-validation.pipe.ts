import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { ProblemException, type ProblemFieldError } from "../../core/http/problem-exception";

// Como ZodValidationPipe, mas aponta cada chave desconhecida do objeto estrito (um item por campo).
export class PeopleValidationPipe<T> implements PipeTransform<unknown, T> {
  private readonly schema: ZodType<T>;

  constructor(schema: ZodType<T>) {
    this.schema = schema;
  }

  transform(value: unknown, metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const errors = result.error.issues.flatMap((issue): ProblemFieldError[] => {
      const path = issue.path.map(String);
      if (issue.code === "unrecognized_keys") {
        return issue.keys.map((key) => ({ field: [...path, key].join("."), message: issue.message }));
      }
      return [{ field: path.length === 0 ? metadata.type : path.join("."), message: issue.message }];
    });
    const unique = errors.filter((error, index) => errors.findIndex((other) => other.field === error.field) === index);
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", unique);
  }
}
