/**
 * CPF fictício e válido para testes (travas.md §4.7, RN-P01): os 9 primeiros dígitos são `seed` com zeros à
 * esquerda e os 2 últimos são os dígitos verificadores. Mesmo `seed`, mesmo CPF. Lança `RangeError` se `seed`
 * não for inteiro entre 0 e 999_999_999 ou se os 9 dígitos forem todos iguais (não existe CPF válido assim).
 */
export function fakeCpf(seed: number): string {
  throw new Error(`not implemented: ${String(seed)}`);
}
