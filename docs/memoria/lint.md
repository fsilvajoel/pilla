# Cola do lint (TypeScript)

Regras do ESLint que valem no pilla (`packages/config/eslint.mjs`, travas §3), com o jeito errado e o certo.
O harness põe no pedido da Alice as seções que valem para os arquivos do cartão. `scripts/check-lint-sheet.mjs`
roda o ESLint em cada exemplo: o "errado" tem de acusar a regra e o "certo" não. Não existe comentário para
desligar regra (`noInlineConfig`): o código é que muda.

## Todo TypeScript
<!-- scope: ts | probe: packages/schemas/src -->

- `@typescript-eslint/no-explicit-any`: sem `any`; use o tipo real ou `unknown`.
  - errado: `export const f = (x: any): unknown => x;`
  - certo: `export const f = (x: unknown): unknown => x;`
- `@typescript-eslint/consistent-type-assertions`: sem `as`; valide (zod) ou estreite com `typeof`.
  - errado: `export const n = JSON.parse("1") as number;`
  - certo: `const raw: unknown = JSON.parse("1"); export const n = typeof raw === "number" ? raw : 0;`
- `@typescript-eslint/consistent-type-assertions` (objeto): para ler as chaves de um `unknown`, estreite com um type guard (`v is Record<string, unknown>`), nunca com `as`.
  - errado: `export const keys = (v: unknown): string[] => Object.keys(v as object);`
  - certo: `const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null; export const keys = (v: unknown): string[] => (isRecord(v) ? Object.keys(v) : []);`
- `@typescript-eslint/no-non-null-assertion`: sem `!`; trate o `undefined`.
  - errado: `export const first = (a: number[]): number => a[0]!;`
  - certo: `export const first = (a: number[]): number => a[0] ?? 0;`
- `@typescript-eslint/no-unsafe-call`: valor `any` (de `JSON.parse`, de lib sem tipo) não é usado direto; dê o tipo `unknown` e estreite.
  - errado: `const fn = JSON.parse("1"); export const r: unknown = fn();`
  - certo: `const fn: unknown = JSON.parse("1"); export const r: unknown = typeof fn === "function" ? null : fn;`
- `@typescript-eslint/no-unused-vars`: nada declarado sem uso; parâmetro que sobra começa com `_`.
  - errado: `const unused = 1; export const a = 2;`
  - certo: `export const f = (_unused: number): number => 2;`
- `prefer-const`: `let` só se o valor muda.
  - errado: `let a = 1; export const b = a;`
  - certo: `const a = 1; export const b = a;`
- `@typescript-eslint/restrict-template-expressions`: em texto com `${}`, só string; número vira `String(n)`.
  - errado: ``export const label = (n: number): string => `total ${n}`;``
  - certo: ``export const label = (n: number): string => `total ${String(n)}`;``
- `@typescript-eslint/restrict-plus-operands`: `+` só entre dois números ou duas strings.
  - errado: `export const label = (n: number): string => "total " + n;`
  - certo: `export const label = (n: number): string => "total " + String(n);`
- `@typescript-eslint/no-unnecessary-condition`: não teste o que o tipo já garante (`??`, `?.`, `if` sobre valor que nunca é nulo).
  - errado: `export const name = (s: string): string => s ?? "";`
  - certo: `export const name = (s: string | undefined): string => s ?? "";`
- `@typescript-eslint/require-await`: função `async` tem `await`; se não tem, tire o `async`.
  - errado: `export const load = async (): Promise<number> => 1;`
  - certo: `export const load = (): number => 1;`
- `@typescript-eslint/no-floating-promises`: toda promessa recebe `await` (ou `void`, se for de propósito).
  - errado: `const run = (): Promise<void> => Promise.resolve(); export const start = (): void => { run(); };`
  - certo: `const run = (): Promise<void> => Promise.resolve(); export const start = async (): Promise<void> => { await run(); };`
- `@typescript-eslint/ban-ts-comment`: sem `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`; corrija o tipo.
  - errado: `/* @ts-ignore */ export const a: number = 1;`
  - certo: `export const a: number = 1;`
- `no-console`: sem `console`; devolva o valor ou lance um erro.
  - errado: `export const f = (): void => { console.log("x"); };`
  - certo: `export const f = (): string => "x";`
- `no-restricted-syntax`: só export nomeado.
  - errado: `export default 1;`
  - certo: `export const one = 1;`

## Código puro (`packages/finance/src` e pastas `domain/`)
<!-- scope: pure | probe: packages/finance/src -->

- `no-restricted-properties`: sem `Math` (ponto flutuante, ADR-0004); a conta é em `bigint`.
  - errado: `export const half = (n: number): number => Math.round(n / 2);`
  - certo: `export const half = (n: bigint): bigint => n / 2n;`
- `no-restricted-globals`: sem `Number` e sem `parseFloat`; converta com `BigInt`.
  - errado: `export const a = Number("1"); export const b = parseFloat("1");`
  - certo: `export const a = BigInt("1");`
- `no-restricted-syntax`: sem `new Date()`, sem `Date.now()` (o relógio vem por parâmetro) e sem literal decimal.
  - errado: `export const now = new Date(); export const ms = Date.now(); export const rate = 0.5;`
  - certo: `export const isAfter = (today: string, due: string): boolean => today > due;`

## Testes (`*.test.ts`)
<!-- scope: test | probe: packages/finance/src | suffix: .test.ts -->

- `no-restricted-syntax`: sem `.only` e `.skip`; sem `expect(true)`. Em teste o `as` é permitido.
  - errado: `declare const it: { only: (n: string) => void }; declare const expect: (v: unknown) => void; it.only("x"); expect(true);`
  - certo: `declare const expect: (v: unknown) => void; expect(1 + 1);`
