// Identificadores das entidades: UUID v7 (RFC-004 §2, RFC 9562 §5.7), ordenados pelo tempo de criação.

/**
 * UUID v7 em texto minúsculo a partir de `unixMs` (milissegundos, inteiro de 0 a 2^48 - 1) e de exatamente
 * 10 bytes aleatórios. Lança `RangeError` se `unixMs` ou `random` estiverem fora disso.
 */
export function uuidV7(unixMs: number, random: Uint8Array): string {
  if (!Number.isInteger(unixMs) || unixMs < 0 || unixMs > 281474976710655) {
    throw new RangeError("unixMs must be an integer from 0 to 2^48 - 1");
  }
  if (random.length !== 10) {
    throw new RangeError("random must have exactly 10 bytes");
  }
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(unixMs) << 16n);
  bytes.set(random, 6);
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x70);
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Novo UUID v7 com o relógio atual (`Date.now`) e 10 bytes de `crypto.getRandomValues`. */
export function newId(): string {
  return uuidV7(Date.now(), crypto.getRandomValues(new Uint8Array(10)));
}
