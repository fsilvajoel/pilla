// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import { Module } from "@nestjs/common";
import type { DynamicModule, OnApplicationShutdown } from "@nestjs/common";
import type { ApiEnv } from "./core/http/env";

@Module({})
export class AppModule implements OnApplicationShutdown {
  static forRoot(_env: ApiEnv): DynamicModule {
    throw new Error("esboço: não implementado");
  }
  onApplicationShutdown(): Promise<void> {
    throw new Error("esboço: não implementado");
  }
}
