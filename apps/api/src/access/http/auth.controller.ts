import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { adminLoginRequest, type AdminLoginRequest, type AdminMeResponse } from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import { Public } from "../../core/http/public";
import { expiredSessionCookie, readSessionCookie, sessionCookie } from "../../core/http/session-cookie";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { DATABASE, type Database } from "../../db/database";
import { loginAdmin } from "../application/login";
import { endSession, resolveAdminSession } from "../application/sessions";
import { clientIp, type ClientRequest } from "./client-ip";
import { LoginThrottlerGuard } from "./login-throttler.guard";

type HeaderSetter = { setHeader(name: string, value: string): unknown };

const INVALID_LOGIN = "Usuário ou senha inválidos.";
const NO_SESSION = "Sessão ausente ou expirada.";

// Entrada do ADMIN (E14 D5). Só o login é público; logout e me passam pelo guard global (E14 D7).
@Controller("auth")
export class AuthController {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  @Public()
  @Post("admin/login")
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  async login(
    @Body(new ZodValidationPipe<AdminLoginRequest>(adminLoginRequest)) body: AdminLoginRequest,
    @Req() request: ClientRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<AdminMeResponse> {
    const result = await loginAdmin(this.db, body, clientIp(request));
    if (result === null) throw new ProblemException("UNAUTHENTICATED", INVALID_LOGIN);
    response.setHeader("Set-Cookie", sessionCookie(result.token));
    return result.admin;
  }

  @Post("admin/logout")
  @HttpCode(204)
  async logout(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<void> {
    const token = readSessionCookie(cookie);
    if (token !== undefined) await endSession(this.db, token);
    response.setHeader("Set-Cookie", expiredSessionCookie());
  }

  @Get("me")
  async me(@Headers("cookie") cookie: string | undefined): Promise<AdminMeResponse> {
    const token = readSessionCookie(cookie);
    const admin = token === undefined ? null : await resolveAdminSession(this.db, token);
    if (admin === null) throw new ProblemException("UNAUTHENTICATED", NO_SESSION);
    return admin;
  }
}
