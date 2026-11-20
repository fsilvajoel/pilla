// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import { Controller, Get } from "@nestjs/common";
export type OpenApiDocument = Readonly<Record<string, unknown>>; // forma exata no plano (Contrato)
export function buildOpenApiDocument(): OpenApiDocument {
  throw new Error("esboço: não implementado");
}

@Controller("openapi.json")
export class OpenApiController {
  @Get()
  document(): OpenApiDocument {
    throw new Error("esboço: não implementado");
  }
}
