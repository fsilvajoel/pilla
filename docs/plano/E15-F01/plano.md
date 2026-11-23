# E15-F01: contratos Zod do portal e do acesso

Plano da feature. Cartões: E15-T01 (testes, Haiku) e E15-T02 (schemas, Haiku). Referências: PRD-001 RF-61 a RF-63,
ADR-0007, ADR-0004, RFC-004 §4 e §5, `docs/plano/E15.md` D2 e D10.

## Escopo

Entra, em `packages/schemas/src/api/access/` (novo) e exportado em `packages/schemas/src/index.ts`:
- `portal-session.ts`: `createPortalSessionRequest` = `z.strictObject({cpf: cpfSchema})`.
- `portal-loans.ts`: `portalSituationSchema` (`CURRENT | OVERDUE | PAID_OFF`), `portalPaymentMethodSchema` (`PIX | BOLETO
  | CASH | BANK_TRANSFER`), `portalLoanListItem`, `portalLoanListResponse`, `portalLoanDetailResponse` com os campos da
  D2. Tudo `z.strictObject`; dinheiro `centsSchema`, datas `isoDateSchema`, ids `idSchema`, número `loanNumberSchema`,
  status da parcela o `installmentStatusSchema` que já existe.
- `portal-access.ts`: `setPortalAccessRequest` `{enabled: boolean}` e `portalAccessResponse` `{personId, enabled,
  enabledAt: instante | null}`.

Fora: qualquer campo de pessoa (nome, CPF, contato), qualquer dado interno do contrato.

## Domínio das entradas

| Campo | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `cpf` | 11 dígitos | 11 | 11 | pontuação, 10 ou 12 dígitos, dígito verificador errado, repetidos (11111111111), vazio, número | 400 | RN-P01, `cpfSchema` |
| `enabled` | boolean | - | - | `"true"`, 0, ausente, campo extra | 400 | D2 |
| `*Cents` | inteiro | 0 | `Number.MAX_SAFE_INTEGER` | decimal, negativo, string | schema | ADR-0004 |
| `situation` | enum | - | - | `ACTIVE`, `WRITTEN_OFF`, qualquer outro | schema | D2 |
| objetos | estritos | - | - | chave desconhecida (nome, cpf, internalNotes, interestRateBps...) | schema | RF-63 |

## Critérios de aceite

- A1: `createPortalSessionRequest` aceita CPF válido só com dígitos e rejeita os casos da tabela, e rejeita chave extra.
- A2: `portalLoanDetailResponse` aceita o exemplo da RFC-004 §5 completado (com `id`, `situation`, `lateChargesCents`,
  `nextInstallment`, `paidCents` por parcela) e aceita `nextInstallment: null`.
- A3: o detalhe e a lista **rejeitam** cada uma destas chaves extras, no topo e dentro de parcelas e pagamentos:
  `personId`, `personName`, `cpf`, `internalNotes`, `monthlyInterestRateBps`, `lateFeeBps`, `accountId`, `paymentId`,
  `pixEndToEndId`, `receipt`, `originType`.
- A4: `situation` aceita só `CURRENT`, `OVERDUE`, `PAID_OFF`; `method` só os quatro métodos.
- A5: `setPortalAccessRequest` e `portalAccessResponse` aceitam os exemplos e rejeitam os casos da tabela.

## Casos de teste

`packages/schemas/src/api/access/portal-session.test.ts`, `portal-loans.test.ts`, `portal-access.test.ts`
(Vitest, sem banco). C1..C3 CPF; C4..C6 detalhe (exemplo, null, valores inválidos); C7 uma chave extra por vez
(`it.each`); C8 enums; C9..C10 acesso.

## Riscos

- Campo novo "inocente" no futuro vira vazamento: por isso `strictObject` e o `it.each` da A3 (a lista cresce, não
  encolhe).

## Dependências

Nenhuma (só `packages/schemas`). Destrava F02, F03, F04.
