// stub E9-F02: substituído no E9-T03.
import type { HealthResponse } from "@pilla/schemas";

export class HealthController {
  check(): Promise<HealthResponse> {
    throw new Error("esboço: não implementado");
  }
}
