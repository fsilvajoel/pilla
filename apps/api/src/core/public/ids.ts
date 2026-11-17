// @stub E5-T02
// Identificadores das entidades: UUID v7 (RFC-004 §2, RFC 9562 §5.7), ordenados pelo tempo de criação.

/**
 * UUID v7 em texto minúsculo a partir de `unixMs` (milissegundos, inteiro de 0 a 2^48 - 1) e de exatamente
 * 10 bytes aleatórios. Lança `RangeError` se `unixMs` ou `random` estiverem fora disso.
 */
export function uuidV7(_unixMs: number, _random: Uint8Array): string {
  throw new Error("not implemented");
}

/** Novo UUID v7 com o relógio atual (`Date.now`) e 10 bytes de `crypto.getRandomValues`. */
export function newId(): string {
  throw new Error("not implemented");
}
