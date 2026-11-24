import { Controller, Get } from "@nestjs/common";
import { healthResponseSchema, problemSchema } from "@pilla/schemas";
import { z } from "zod";
import { Public } from "./public";

type JsonSchema = z.core.JSONSchema.BaseSchema;
type SchemaRef = { readonly $ref: string };

export type OpenApiDocument = {
  readonly openapi: "3.1.0";
  readonly info: { readonly title: string; readonly version: string };
  readonly servers: readonly { readonly url: string }[];
  readonly paths: {
    readonly "/health": {
      readonly get: {
        readonly operationId: "getHealth";
        readonly responses: {
          readonly "200": {
            readonly description: string;
            readonly content: { readonly "application/json": { readonly schema: SchemaRef } };
          };
          readonly "500": {
            readonly description: string;
            readonly content: { readonly "application/problem+json": { readonly schema: SchemaRef } };
          };
        };
      };
    };
  };
  readonly components: { readonly schemas: { readonly HealthResponse: JsonSchema; readonly Problem: JsonSchema } };
};

// OpenAPI gerado do zod (ADR-0017): o schema em packages/schemas é a fonte da verdade.
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
      schemas: { HealthResponse: z.toJSONSchema(healthResponseSchema), Problem: z.toJSONSchema(problemSchema) },
    },
  };
}

@Public()
@Controller("openapi.json")
export class OpenApiController {
  @Get()
  document(): OpenApiDocument {
    return buildOpenApiDocument();
  }
}
