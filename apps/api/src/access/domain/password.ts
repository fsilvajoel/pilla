// Esboço do E14-T01; a implementação com argon2id (E14 D2, ADR-0011) é do E14-T02.
export function hashPassword(_plain: string): Promise<string> {
  return Promise.reject(new Error("esboço: não implementado"));
}

export function verifyPassword(_hash: string, _plain: string): Promise<boolean> {
  return Promise.reject(new Error("esboço: não implementado"));
}

export function verifyAgainstDummy(_plain: string): Promise<boolean> {
  return Promise.reject(new Error("esboço: não implementado"));
}
