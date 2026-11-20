import { NotFoundException, type INestApplication } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { ProblemDetailsFilter, sendProblem, toProblem } from "./problem-details.filter";

const PREFIX = "api/v1";

// Prefixo /api/v1 e filtro problem+json globais (D1, RFC-004 §2).
export function configureApp(app: INestApplication): void {
  // Sem ETag automático: a API não usa If-Match/ETag, a versão trafega no corpo (RFC-004).
  const instance: unknown = app.getHttpAdapter().getInstance();
  const set: unknown = typeof instance === "function" ? Reflect.get(instance, "set") : undefined;
  if (typeof set === "function") Reflect.apply(set, instance, ["etag", false]);
  app.setGlobalPrefix(PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(HttpAdapterHost)));
  // O 404 do Nest só cobre rotas dentro do prefixo; fora dele o Express responderia HTML.
  const adapter = app.get(HttpAdapterHost).httpAdapter;
  app.use((request: unknown, response: unknown, next: () => void) => {
    if (String(adapter.getRequestUrl(request)).startsWith(`/${PREFIX}`)) {
      next();
      return;
    }
    sendProblem(adapter, response, toProblem(new NotFoundException()));
  });
}
