// Apoio dos testes HTTP: sobe um app Nest em memória com o mesmo configureApp da produção.
import type { INestApplication, Provider, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { RequestActor } from "../public/actor";
import type { ActorRequest } from "./actor";
import { configureApp } from "./configure-app";
import { TEST_ADMIN_ACTOR } from "./test-actor";

/** `actor`: ator posto na requisição (padrão TEST_ADMIN_ACTOR); `null` não põe nenhum (E14 D8). */
export type TestAppOptions = { readonly actor?: RequestActor | null };

/** Sem guard: o ator entra por um middleware global, para o teste seguir focado no módulo (E14 D8). */
export async function createTestApp(
  controllers: Type[],
  providers: Provider[] = [],
  options: TestAppOptions = {},
): Promise<INestApplication> {
  const actor = options.actor === undefined ? TEST_ADMIN_ACTOR : options.actor;
  const moduleRef = await Test.createTestingModule({ controllers, providers }).compile();
  const app = moduleRef.createNestApplication();
  if (actor !== null) {
    app.use((request: ActorRequest, _response: unknown, next: () => void) => {
      request.actor = actor;
      next();
    });
  }
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  return app;
}
