import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ProblemException } from "../../core/http/problem-exception";
import { DATABASE, type Database } from "../../db/database";
import { resolvePortalPerson } from "../application/portal-session-service";
import { readPortalToken } from "../http/portal-cookie";
import type { PortalRequest } from "./portal-person";

const NO_SESSION = "Sessão ausente ou expirada.";

type CookieRequest = PortalRequest & { headers: { cookie?: string | undefined } };
type HeaderSetter = { setHeader(name: string, value: string): unknown };

/**
 * Guarda das rotas do portal (E15 D7, ADR-0007): sessão CLIENT viva e acesso ainda habilitado, senão 401. Entrega a
 * pessoa à rota por `@PortalPerson()`. Rota do portal leva também `@Public()`, que só dispensa o guard global ADMIN.
 */
@Injectable()
export class PortalSessionGuard implements CanActivate {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    http.getResponse<HeaderSetter>().setHeader("Cache-Control", "no-store");
    const request = http.getRequest<CookieRequest>();
    const token = readPortalToken(request.headers.cookie);
    const personId = token === undefined ? null : await resolvePortalPerson(this.db, token);
    if (personId === null) throw new ProblemException("UNAUTHENTICATED", NO_SESSION);
    request.portalActor = { personId };
    return true;
  }
}
