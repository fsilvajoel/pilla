// Composição da API: controllers do núcleo e provider de banco (trocável nos testes por DATABASE_HANDLE).
import { Inject, Module } from "@nestjs/common";
import type { DynamicModule, OnApplicationShutdown } from "@nestjs/common";
import type { ApiEnv } from "./core/http/env";
import { HealthController } from "./core/http/health.controller";
import { OpenApiController } from "./core/http/openapi";
import { createDatabase, DATABASE, DATABASE_HANDLE } from "./db/database";
import type { DatabaseHandle } from "./db/database";

@Module({})
export class AppModule implements OnApplicationShutdown {
  private closed = false;

  constructor(@Inject(DATABASE_HANDLE) private readonly handle: DatabaseHandle) {}

  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, OpenApiController],
      providers: [
        { provide: DATABASE_HANDLE, useFactory: (): DatabaseHandle => createDatabase(env.databaseUrl) },
        { provide: DATABASE, useFactory: (handle: DatabaseHandle) => handle.db, inject: [DATABASE_HANDLE] },
      ],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.handle.close();
  }
}
