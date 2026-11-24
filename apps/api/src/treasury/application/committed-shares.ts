const FULL_BPS = 10000;

export interface CommittedShares {
  committedBps: number | null;
  availableBps: number | null;
}

/** Parcela do capital emprestado e a disponível, em pontos-base (E12 D7). */
export function committedShares(cashCents: number, lentCents: number): CommittedShares {
  const base = cashCents + lentCents;
  // caixa negativo (ou base vazia) não tem parcela com sentido: a tela mostra "—" (E12 D7)
  const committedBps = cashCents >= 0 && base > 0 ? Math.floor((lentCents * FULL_BPS) / base) : null;
  return { committedBps, availableBps: committedBps === null ? null : FULL_BPS - committedBps };
}
