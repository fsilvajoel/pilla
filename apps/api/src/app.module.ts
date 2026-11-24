import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ACCESS_HASH_KEY } from "./access/application/access-hash-key";
import { AccessModule } from "./access/access.module";
import { AdminSessionGuard } from "./access/http/admin-session.guard";
import { AUTH_ENFORCED } from "./access/http/auth-enforced";
import { HealthController } from "./core/http/health.controller";
import type { ApiEnv } from "./core/http/env";
import { OpenApiController } from "./core/http/openapi";
import { AccountsController } from "./treasury/http/accounts.controller";
import { TreasurySummaryController } from "./treasury/http/treasury-summary.controller";
import { LendingModule } from "./lending/lending.module";
import { PaymentsModule } from "./payments/payments.module";
import { PeopleModule } from "./people/people.module";
import { OUTBOX_CONSUMERS, OutboxPoller } from "./core/infra/outbox-poller";
import { treasuryOutboxConsumers } from "./treasury/public/outbox-consumers";
import { createDatabase, DATABASE, DATABASE_HANDLE, type DatabaseHandle } from "./db/database";

@Module({})
export class AppModule implements OnApplicationShutdown {
  private readonly handle: DatabaseHandle;

  constructor(@Inject(DATABASE_HANDLE) handle: DatabaseHandle) {
    this.handle = handle;
  }

  /** `outboxPoller: false` desliga o agendador do outbox (testes que limpam tabelas não podem correr com ele). */
  static forRoot(env: ApiEnv, options: { readonly outboxPoller?: boolean } = {}): DynamicModule {
    const { outboxPoller = true } = options;
    return {
      module: AppModule,
      global: true,
      imports: [PeopleModule, LendingModule, PaymentsModule, AccessModule],
      controllers: [HealthController, OpenApiController, AccountsController, TreasurySummaryController],
      providers: [
        { provide: DATABASE_HANDLE, useFactory: (): DatabaseHandle => createDatabase(env.databaseUrl) },
        { provide: DATABASE, useFactory: (handle: DatabaseHandle) => handle.db, inject: [DATABASE_HANDLE] },
        { provide: AUTH_ENFORCED, useValue: env.authEnforced ?? true },
        { provide: ACCESS_HASH_KEY, useValue: env.accessHashKey },
        // Guard global ADMIN (E14 D7): ligado uma vez só, aqui.
        { provide: APP_GUARD, useClass: AdminSessionGuard },
        { provide: OUTBOX_CONSUMERS, useValue: treasuryOutboxConsumers },
        ...(outboxPoller ? [OutboxPoller] : []),
      ],
      exports: [DATABASE, AUTH_ENFORCED, ACCESS_HASH_KEY],
    };
  }

  onApplicationShutdown(): Promise<void> {
    return this.handle.close();
  }
}
