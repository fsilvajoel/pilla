import { randomBytes } from "node:crypto";
import argon2 from "argon2";

// Parâmetros do argon2id conforme ADR-0011 e E14 D2 (recomendação OWASP).
const MEMORY_COST_KIB = 19456;
const TIME_COST = 2;
const PARALLELISM = 1;

const options = {
  type: argon2.argon2id,
  memoryCost: MEMORY_COST_KIB,
  timeCost: TIME_COST,
  parallelism: PARALLELISM,
} as const;

/** Hash argon2id codificado, com sal aleatório. */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, options);
}

/** `true` só para a mesma senha; hash malformado dá `false`, sem exceção. */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// Hash de uma senha aleatória descartada, calculado uma vez ao carregar o módulo.
const dummyHash: Promise<string> = hashPassword(randomBytes(32).toString("base64url"));

/** Gasta o custo de uma verificação real quando o usuário não existe; sempre `false` (E14 D2). */
export async function verifyAgainstDummy(plain: string): Promise<boolean> {
  await verifyPassword(await dummyHash, plain);
  return false;
}
