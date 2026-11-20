// stub E9-F02: substituído no E9-T03.
import type { DynamicModule } from "@nestjs/common";
import type { ApiEnv } from "./core/http/env";

export class AppModule {
  static forRoot(_env: ApiEnv): DynamicModule {
    throw new Error("esboço: não implementado");
  }

  onApplicationShutdown(): Promise<void> {
    throw new Error("esboço: não implementado");
  }
}
