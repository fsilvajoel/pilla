import type { Database } from "../../db/database";
import type { PaymentRow } from "./schema";

/** Esboço (E11-T03): pagamento com a Idempotency-Key dada, se houver; implementado na E11-T04. */
export function findPaymentByIdempotencyKey(_db: Database, _key: string): Promise<PaymentRow | null> {
  return Promise.reject(new Error("esboço: não implementado"));
}
