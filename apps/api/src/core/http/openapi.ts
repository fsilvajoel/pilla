// stub E9-F02: substituído no E9-T03.
export type OpenApiDocument = Readonly<Record<string, unknown>>;

export function buildOpenApiDocument(): OpenApiDocument {
  throw new Error("esboço: não implementado");
}

export class OpenApiController {
  document(): OpenApiDocument {
    throw new Error("esboço: não implementado");
  }
}
