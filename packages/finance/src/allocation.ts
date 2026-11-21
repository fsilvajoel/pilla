import { lateChargesAt, openAmount, outstandingBalance } from "./balance";
import type { LateTerms, OpenInstallment } from "./balance";
import { daysBetween } from "./date";
import type { IsoDate } from "./date";
import type { Cents } from "./money";
import { cents } from "./money";

/** Quanto do pagamento foi para cada componente de uma parcela (RFC-004: PaymentConfirmed.allocations). */
export interface PaymentAllocation {
  readonly installmentNumber: number;
  readonly lateCharges: Cents;
  readonly interest: Cents;
  readonly principal: Cents;
  /** situação da parcela depois desta alocação. */
  readonly status: "PAID" | "PARTIAL";
}

export class AllocationError extends Error {
  constructor(
    readonly code: "PAYMENT_EXCEEDS_BALANCE" | "INVALID_PAYMENT",
    message?: string,
  ) {
    super(message ?? code);
  }
}

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/** Mais antiga primeiro; mesmo vencimento → menor número. */
function byDueDate(a: OpenInstallment, b: OpenInstallment): number {
  return daysBetween(b.dueDate, a.dueDate) || a.number - b.number;
}

/**
 * RFC-002 §3.6 / RN-R02, RN-R03, RN-R04. Parcelas em aberto da mais antiga para a mais nova;
 * em cada uma: encargos (na data `ref`) → juros → principal; a sobra vai para a próxima.
 * Erro INVALID_PAYMENT se amount <= 0; PAYMENT_EXCEEDS_BALANCE se amount > outstandingBalance(ref) (T-06).
 * Parcelas sem valor em aberto nem encargos devidos são ignoradas.
 */
export function allocatePayment(
  amount: Cents,
  installments: readonly OpenInstallment[],
  terms: LateTerms,
  ref: IsoDate,
): PaymentAllocation[] {
  if (amount <= 0n) throw new AllocationError("INVALID_PAYMENT", "payment must be positive");
  if (amount > outstandingBalance(installments, terms, ref)) throw new AllocationError("PAYMENT_EXCEEDS_BALANCE");

  const allocations: PaymentAllocation[] = [];
  let remaining: bigint = amount;
  for (const installment of [...installments].sort(byDueDate)) {
    if (remaining === 0n) break;
    const charges = lateChargesAt(installment, terms, ref);
    if (openAmount(installment) === 0n && charges === 0n) continue;
    const toCharges = min(remaining, charges);
    const toInterest = min(remaining - toCharges, installment.openInterest);
    const toPrincipal = min(remaining - toCharges - toInterest, installment.openPrincipal);
    remaining -= toCharges + toInterest + toPrincipal;
    const paid = toCharges + toInterest + toPrincipal === charges + openAmount(installment);
    allocations.push({
      installmentNumber: installment.number,
      lateCharges: cents(toCharges),
      interest: cents(toInterest),
      principal: cents(toPrincipal),
      status: paid ? "PAID" : "PARTIAL",
    });
  }
  return allocations;
}
