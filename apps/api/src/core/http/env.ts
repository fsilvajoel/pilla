// stub E9-F02: substituído no E9-T03.
export type ApiEnv = { readonly host: "127.0.0.1"; readonly port: number; readonly databaseUrl: string };

export function readApiEnv(_env: Readonly<Record<string, string | undefined>>): ApiEnv {
  throw new Error("esboço: não implementado");
}
