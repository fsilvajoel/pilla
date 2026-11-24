import { Logger, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./core/http/configure-app";
import { readApiEnv } from "./core/http/env";

// Sobe a API em 127.0.0.1:PILLA_API_PORT (D3). Sem efeito colateral na importação; o script `start` chama bootstrap(process.env).
export async function bootstrap(env: Readonly<Record<string, string | undefined>>): Promise<INestApplication> {
  const apiEnv = readApiEnv(env);
  if (apiEnv.authEnforced === false) new Logger("Bootstrap").warn("autenticação DESLIGADA, só desenvolvimento");
  const app = await NestFactory.create(AppModule.forRoot(apiEnv));
  configureApp(app);
  await app.listen(apiEnv.port, apiEnv.host);
  return app;
}
