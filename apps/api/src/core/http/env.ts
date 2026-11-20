// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
export type ApiEnv = { readonly host: "127.0.0.1"; readonly port: number; readonly databaseUrl: string };
export function readApiEnv(_env: Readonly<Record<string, string | undefined>>): ApiEnv {
  throw new Error("esboço: não implementado");
}
