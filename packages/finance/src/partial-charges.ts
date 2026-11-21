import { calculateLateCharges } from "./late-charges";
import { daysBetween } from "./date";
import type { IsoDate } from "./date";
import type { Bps, Cents } from "./money";
import { bps, cents } from "./money";

/** Pagamento confirmado de uma parcela (sem os estornados): data e os três componentes pagos. */
export interface InstallmentPayment {
  readonly paidAt: IsoDate;
  readonly lateCharges: Cents;
  readonly interest: Cents;
  readonly principal: Cents;
}

/** O que os encargos pedem da parcela (OpenInstallment serve; os tipos ficam aqui para não haver ciclo com balance). */
export interface ChargeInstallment {
  readonly dueDate: IsoDate;
  readonly openPrincipal: Cents;
  readonly openInterest: Cents;
  readonly payments?: readonly InstallmentPayment[];
}

/** Condições de atraso usadas nos encargos (LateTerms serve). */
export interface ChargeTerms {
  readonly finePercent: Bps;
  readonly lateInterestMonthlyRate: Bps;
  readonly graceDays: number;
  readonly roundingStep: Cents;
}

/** Estado dobrado do histórico: multa já cobrada, encargos ainda devidos e data de onde a mora corre. */
interface ChargeState {
  readonly fineCharged: boolean;
  readonly owed: bigint;
  readonly accrualFrom: IsoDate;
}

/**
 * Encargos novos sobre `open` até `at`. Antes de a multa ser cobrada vale RN-E01/RN-E02 desde o vencimento
 * (com a carência); depois, só a mora, a partir da data do último pagamento (RFC-002 §3.5).
 */
function newCharges(
  open: Cents,
  state: ChargeState,
  installment: ChargeInstallment,
  terms: ChargeTerms,
  at: IsoDate,
): bigint {
  const fineCharged = state.fineCharged;
  return calculateLateCharges({
    openAmount: open,
    dueDate: fineCharged ? state.accrualFrom : installment.dueDate,
    referenceDate: at,
    finePercent: fineCharged ? bps(0n) : terms.finePercent,
    lateInterestMonthlyRate: terms.lateInterestMonthlyRate,
    graceDays: fineCharged ? 0 : terms.graceDays,
    roundingStep: terms.roundingStep,
  }).total;
}

/**
 * RFC-002 §3.5: encargos da parcela em `ref` levando em conta o histórico de pagamentos.
 * Os pagamentos são dobrados em ordem de `paidAt`: em cada um, devido = encargos que sobraram + encargos novos
 * sobre o em aberto da época; o que não foi pago continua devido, a multa fica marcada como cobrada e a mora
 * passa a correr dali (pagamento sem encargos pagos não altera o estado). Sem histórico, o resultado é o de `calculateLateCharges` sobre o em aberto.
 */
export function lateChargesWithHistory(installment: ChargeInstallment, terms: ChargeTerms, ref: IsoDate): Cents {
  const payments = [...(installment.payments ?? [])].sort((a, b) => daysBetween(b.paidAt, a.paidAt));
  // o em aberto antes do primeiro pagamento: o de hoje mais tudo o que foi abatido
  let open: bigint = installment.openPrincipal + installment.openInterest;
  for (const p of payments) open += p.interest + p.principal;

  let state: ChargeState = { fineCharged: false, owed: 0n, accrualFrom: installment.dueDate };
  for (const p of payments) {
    // Pagamento sem encargos pagos não mexe no estado: a alocação paga encargos primeiro, então ele só existe
    // sem encargos devidos (carência, antes do vencimento) ou em dado legado/importado, que segue a regra da E10.
    if (p.lateCharges === 0n) {
      open -= p.interest + p.principal;
      continue;
    }
    const due = state.owed + newCharges(cents(open), state, installment, terms, p.paidAt);
    const fineDue = !state.fineCharged && open > 0n && daysBetween(installment.dueDate, p.paidAt) > terms.graceDays;
    const charged = state.fineCharged || fineDue;
    state = {
      fineCharged: charged,
      owed: due > p.lateCharges ? due - p.lateCharges : 0n,
      accrualFrom: charged ? p.paidAt : state.accrualFrom,
    };
    open -= p.interest + p.principal;
  }
  const current = installment.openPrincipal + installment.openInterest;
  return cents(state.owed + newCharges(cents(current), state, installment, terms, ref));
}
