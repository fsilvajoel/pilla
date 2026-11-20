// Apoio dos testes HTTP: sobe um app Nest em memória com o mesmo configureApp da produção.
import type { INestApplication, Provider, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { configureApp } from "./configure-app";

export async function createTestApp(controllers: Type[], providers: Provider[] = []): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers, providers }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  return app;
}
