import { Module } from "@nestjs/common";
import { ThrottlerModule, type ThrottlerOptions } from "@nestjs/throttler";
import { AuthController } from "./http/auth.controller";
import { LoginThrottlerGuard } from "./http/login-throttler.guard";
import { PortalAccessController } from "./http/portal-access.controller";
import { PortalSessionController } from "./http/portal-session.controller";

/** Limite do login (E14 D6, pendência de PM E14-T03): 5 tentativas por minuto por IP, contador em memória. */
const LOGIN_LIMIT: ThrottlerOptions = { ttl: 60_000, limit: 5 };

// M6 Acesso (E14 D1): nenhum outro módulo importa este. O guard global é ligado como APP_GUARD no AppModule.
@Module({
  imports: [ThrottlerModule.forRoot([LOGIN_LIMIT])],
  controllers: [AuthController, PortalSessionController, PortalAccessController],
  providers: [LoginThrottlerGuard],
})
export class AccessModule {
  /** Limite de tentativas aplicado só ao login. */
  readonly loginLimit: ThrottlerOptions = LOGIN_LIMIT;
}
