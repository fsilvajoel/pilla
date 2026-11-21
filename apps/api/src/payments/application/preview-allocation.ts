import type { AllocationPreviewRequest, AllocationPreviewResponse } from "@pilla/schemas";
import type { Database } from "../../db/database";

/** Esboço (E11-T01): prévia da alocação (RF-23), implementada na E11-T02. Não grava nada. */
export function previewAllocation(
  _db: Database,
  _request: AllocationPreviewRequest,
  _today: string,
): Promise<AllocationPreviewResponse> {
  return Promise.reject(new Error("esboço: não implementado"));
}
