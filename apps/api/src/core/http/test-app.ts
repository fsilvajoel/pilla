// Apoio dos testes HTTP: sobe um app Nest em memória com o mesmo configureApp da produção.
import type { INestApplication, Provider, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { RequestActor } from "../public/actor";
import { configureApp } from "./configure-app";

/** `actor`: ator posto na requisição (padrão TEST_ADMIN_ACTOR); `null` não põe nenhum (E14 D8, esboço até a E14-T06). */
export type TestAppOptions = { readonly actor?: RequestActor | null };

export async function createTestApp(
  controllers: Type[],
  providers: Provider[] = [],
  _options: TestAppOptions = {},
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers, providers }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  return app;
}
