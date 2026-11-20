// Bootstrap da API: escuta só em 127.0.0.1 (D3), prefixo /api/v1. Sem efeito colateral na importação.
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { configureApp } from "./core/http/configure-app";
import { readApiEnv } from "./core/http/env";

export async function bootstrap(env: Readonly<Record<string, string | undefined>>): Promise<INestApplication> {
  const apiEnv = readApiEnv(env);
  const app = await NestFactory.create(AppModule.forRoot(apiEnv));
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(apiEnv.port, apiEnv.host);
  return app;
}
