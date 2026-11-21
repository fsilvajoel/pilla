import type { LateTerms, OpenInstallment } from "./balance";
import type { IsoDate } from "./date";
import type { Cents } from "./money";

/** Pagamento confirmado de uma parcela (sem os estornados): data e os três componentes pagos. */
export interface InstallmentPayment {
  readonly paidAt: IsoDate;
  readonly lateCharges: Cents;
  readonly interest: Cents;
  readonly principal: Cents;
}

/** RFC-002 §3.5: encargos da parcela em `ref` levando em conta o histórico de pagamentos (esboço do E11-T12). */
export function lateChargesWithHistory(_installment: OpenInstallment, _terms: LateTerms, _ref: IsoDate): Cents {
  throw new Error("esboço: não implementado");
}
