// OpenAPI gerado do zod (ADR-0017): o schema é a fonte da verdade, sem dependência nova.
import { Controller, Get } from "@nestjs/common";
import { healthResponseSchema, problemSchema } from "@pilla/schemas";
import { z } from "zod";

type JsonSchema = Readonly<Record<string, unknown>>;
type OpenApiResponse = {
  readonly description: string;
  readonly content: Readonly<Record<string, { readonly schema: { readonly $ref: string } }>>;
};

export type OpenApiDocument = {
  readonly openapi: "3.1.0";
  readonly info: { readonly title: string; readonly version: string };
  readonly servers: readonly { readonly url: string }[];
  readonly paths: Readonly<
    Record<
      string,
      Readonly<
        Record<string, { readonly operationId: string; readonly responses: Readonly<Record<string, OpenApiResponse>> }>
      >
    >
  >;
  readonly components: { readonly schemas: Readonly<Record<string, JsonSchema>> };
};

export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: { title: "pilla API", version: "0.1.0" },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          responses: {
            "200": {
              description: "Estado da API e do banco.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
            },
            "500": {
              description: "Erro interno.",
              content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        HealthResponse: z.toJSONSchema(healthResponseSchema),
        Problem: z.toJSONSchema(problemSchema),
      },
    },
  };
}

@Controller("openapi.json")
export class OpenApiController {
  @Get()
  document(): OpenApiDocument {
    return buildOpenApiDocument();
  }
}
