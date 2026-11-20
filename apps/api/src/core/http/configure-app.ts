// Configuração comum do app Nest: prefixo global e filtro problem+json.
import type { INestApplication } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { notFoundProblem, ProblemDetailsFilter, replyProblem } from "./problem-details.filter";

const prefix = "api/v1";
const prefixPattern = /^\/api\/v1(?:[/?]|$)/;

export function configureApp(app: INestApplication): void {
  const adapterHost = app.get(HttpAdapterHost);
  app.setGlobalPrefix(prefix);
  app.useGlobalFilters(new ProblemDetailsFilter(adapterHost));
  // O 404 interno do Nest só cobre rotas sob o prefixo; fora dele o Express responderia em HTML.
  app.use((request: unknown, response: unknown, next: () => void): void => {
    const url = String(adapterHost.httpAdapter.getRequestUrl(request));
    // Dentro do prefixo: `/api/v1`, `/api/v1/...` ou `/api/v1?query`.
    if (prefixPattern.test(url)) {
      next();
      return;
    }
    replyProblem(adapterHost, response, notFoundProblem());
  });
}
