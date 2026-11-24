import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestActor } from "../public/actor";

/** Requisição com o ator posto pelo guard global (ou pelo createTestApp nos testes de módulo). */
export type ActorRequest = { actor?: RequestActor };

/** Ator da requisição (E14 D1); `undefined` só em rota `@Public()` ou em teste sem ator. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor | undefined =>
    context.switchToHttp().getRequest<ActorRequest>().actor,
);
