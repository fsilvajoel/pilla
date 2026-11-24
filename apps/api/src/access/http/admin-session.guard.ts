import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ActorRequest } from "../../core/http/actor";
import { ProblemException } from "../../core/http/problem-exception";
import { IS_PUBLIC } from "../../core/http/public";
import { readSessionCookie } from "../../core/http/session-cookie";
import { DATABASE, type Database } from "../../db/database";
import { resolveSession } from "../application/sessions";
import { clientIp, type ClientRequest } from "./client-ip";

const NO_SESSION = "Sessão ausente ou expirada.";
const ADMIN_ONLY = "Acesso restrito ao administrador.";

/**
 * Guard global (E14 D7, RN-A01, ADR-0011): toda rota sem `@Public()` exige sessão ADMIN viva; põe o ator na
 * requisição. Único lugar da regra de papel (ADR-0007).
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  private readonly db: Database;
  private readonly reflector: Reflector;

  constructor(@Inject(DATABASE) db: Database, @Inject(Reflector) reflector: Reflector) {
    this.db = db;
    this.reflector = reflector;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;
    const request = context.switchToHttp().getRequest<ClientRequest & ActorRequest>();
    const token = readSessionCookie(request.headers.cookie);
    const session = token === undefined ? null : await resolveSession(this.db, token);
    if (session === null) throw new ProblemException("UNAUTHENTICATED", NO_SESSION);
    if (session.role !== "ADMIN") throw new ProblemException("FORBIDDEN", ADMIN_ONLY);
    request.actor = { type: "ADMIN", adminUserId: session.admin.id, ip: clientIp(request) };
    return true;
  }
}
