# Zod 4 (cola revisada pelo Claude)

Versão do repositório: zod 4.6. O modelo local tende a escrever Zod 3; quando houver dúvida, vale esta cola.

## Use

- Objeto sem campo extra: `z.strictObject({ id: z.uuidv7() })` (nunca `z.object(...).strict()`).
- Inteiro: `z.int()`; não negativo: `z.int().nonnegative()`; positivo: `z.int().positive()`.
- Ids: `z.uuidv7()`. Data de negócio: `z.iso.date()`. Instante com fuso: `z.iso.datetime({ offset: true })`.
- Texto obrigatório: `z.string().trim().min(1).max(500)`.
- Constante: `z.literal("PaymentConfirmed")`; lista fechada: `z.enum(["RENEWAL", "RENEGOTIATION"])`.
- Lista com mínimo: `z.array(allocationSchema).min(1)`.
- Regra entre campos: `.refine((p) => p.a === p.b, { message: "...", path: ["a"] })`.
- Tipo: `type T = z.infer<typeof schema>`.
- No pilla, prefira as primitivas de `packages/schemas/src/common.ts` (idSchema, centsSchema...) a chamar o zod direto.

## Evite (hábito do Zod 3 → Zod 4)

- `z.number().int()` → `z.int()`.
- `z.string().uuid()` → `z.uuidv7()` (ou `z.uuid()`).
- `z.string().email()` → `z.email()`.
- `z.string().datetime()` / `z.string().date()` → `z.iso.datetime()` / `z.iso.date()`.
- `z.object({...}).strict()` → `z.strictObject({...})`.
- `z.nativeEnum(Enum)` → `z.enum(Enum)`.
- `{ required_error: "..." }` / `{ invalid_type_error: "..." }` → `{ error: "..." }`.

## Fonte

- https://zod.dev/api
- https://zod.dev/v4/changelog
