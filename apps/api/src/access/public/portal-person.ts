import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Quem está no portal: a única fonte de `personId` nas rotas do portal (E15 D7, RFC-004 §4). */
export type PortalActor = { readonly personId: string };

/** Requisição com a pessoa posta pelo `PortalSessionGuard`. */
export type PortalRequest = { portalActor?: PortalActor };

/** Pessoa da sessão do portal; só existe em rota protegida por `PortalSessionGuard`. */
export const PortalPerson = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PortalActor | undefined =>
    context.switchToHttp().getRequest<PortalRequest>().portalActor,
);
