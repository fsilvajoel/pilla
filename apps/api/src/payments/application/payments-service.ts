import { Inject, Injectable } from "@nestjs/common";
import type { AllocationPreviewRequest, AllocationPreviewResponse } from "@pilla/schemas";
import { DATABASE, type Database } from "../../db/database";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { previewAllocation } from "./preview-allocation";

@Injectable()
export class PaymentsService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  /** Prévia da alocação (RF-23); nunca grava. */
  allocationPreview(request: AllocationPreviewRequest): Promise<AllocationPreviewResponse> {
    return previewAllocation(this.db, request, todayInBrasilia(new Date()));
  }
}
