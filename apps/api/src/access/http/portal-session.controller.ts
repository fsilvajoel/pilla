import { Body, Controller, Delete, Headers, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { ProblemException } from "../../core/http/problem-exception";
import { Public } from "../../core/http/public";
import { DATABASE, type Database } from "../../db/database";
import { ACCESS_HASH_KEY } from "../application/access-hash-key";
import { endPortalSession, enterPortal } from "../application/portal-session-service";
import { clientIp, type ClientRequest } from "./client-ip";
import { expiredPortalCookie, portalCookie, readPortalToken } from "./portal-cookie";

type HeaderSetter = { setHeader(name: string, value: string | number): unknown };

const GENERIC_DENIAL = "Não foi possível entrar com este CPF.";
const TOO_MANY = "Muitas tentativas. Aguarde um minuto.";

// Entrada e saída do portal (E15 D2 a D6). Públicas para o guard ADMIN: a sessão do cliente é outra (RN-A04).
@Controller("portal/session")
export class PortalSessionController {
  private readonly db: Database;
  private readonly hashKey: string;

  constructor(@Inject(DATABASE) db: Database, @Inject(ACCESS_HASH_KEY) hashKey: string) {
    this.db = db;
    this.hashKey = hashKey;
  }

  @Public()
  @Post()
  @HttpCode(204)
  async enter(
    @Body() body: unknown,
    @Req() request: ClientRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<void> {
    response.setHeader("Cache-Control", "no-store");
    const outcome = await enterPortal(this.db, { body, ip: clientIp(request), hashKey: this.hashKey });
    switch (outcome.kind) {
      case "OK":
        response.setHeader("Set-Cookie", portalCookie(outcome.token));
        return;
      case "INVALID":
        throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
          { field: "cpf", message: "CPF inválido." },
        ]);
      case "RATE_LIMITED":
        response.setHeader("Retry-After", outcome.retryAfterSeconds);
        throw new ProblemException("TOO_MANY_REQUESTS", TOO_MANY);
      case "DENIED":
        throw new ProblemException("UNAUTHENTICATED", GENERIC_DENIAL);
    }
  }

  @Public()
  @Delete()
  @HttpCode(204)
  async leave(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<void> {
    response.setHeader("Cache-Control", "no-store");
    const token = readPortalToken(cookie);
    if (token !== undefined) await endPortalSession(this.db, token);
    response.setHeader("Set-Cookie", expiredPortalCookie());
  }
}
