# E13-F01: editar os parâmetros padrão (nova vigência e auditoria)

Plano da feature. Cartões: E13-T01 (testes de schema, bia), E13-T07 (testes HTTP, claude) e E13-T02 (implementação, baidu). Referências: PRD-001 RF-40, RF-41, RN-E03 e CA-10, ADR-0004, ADR-0006, ADR-0008, RFC-004 §3 e §6, RFC-005 (`default_terms`), `docs/plano/E13.md` D5 e D6, `docs/plano/E10-F03/plano.md`.

## Escopo

Entra:
- `PUT /api/v1/settings/default-terms` com corpo `updateDefaultTermsRequest` (novo, `packages/schemas/src/api/lending/update-default-terms.ts`): `lateFeeBps`, `lateInterestMonthlyBps`, `gracePeriodDays`, `suggestedMonthlyRateBps`, `roundingStepCents`. Estrito; todos obrigatórios (substitui o conjunto inteiro, não é parcial).
- Resposta 200 com `defaultTermsResponse` (o schema que já existe, igual ao do `GET`).
- Efeito: insere uma linha nova em `default_terms` com `effective_from` = agora e `created_by` do ator, e grava uma linha em `core.audit_log` (ação `default_terms.updated`, entidade `default_terms`, `before` = termos vigentes antes, `after` = novos), na mesma transação (ADR-0006).
- Valores iguais aos vigentes: responde 200 com os termos atuais, sem linha nova e sem auditoria (evita linha de histórico vazia).
- `findCurrentDefaultTerms` passa a ordenar por `effective_from` desc e depois `id` desc (desempate estável).
- RF-41: nada novo de código; a feature só prova que o contrato criado depois do `PUT` copia os novos termos (E10-F03).

Fora: data de vigência futura (D5); histórico de vigências na tela; qualquer mudança em `loans` (ADR-0008, D6); a tela (F03A).

## Contrato

| Peça | Assinatura |
|---|---|
| Schema | `updateDefaultTermsRequest = z.strictObject({lateFeeBps, lateInterestMonthlyBps, gracePeriodDays, suggestedMonthlyRateBps, roundingStepCents})` |
| Rota | `PUT /api/v1/settings/default-terms` → 200 `DefaultTermsResponse` |
| Serviço | `LoansService.updateDefaultTerms(request, actor): Promise<DefaultTermsResponse>` |

## Domínio da entrada

| Campo | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| `lateFeeBps` | inteiro (centésimo de %) | 0 | 10000 (100%) | -1, 1.5, "200", 10001 | 422 `VALIDATION_FAILED` | RF-40, `bpsSchema`; teto técnico (pendência E13-F01) |
| `lateInterestMonthlyBps` | inteiro | 0 | 10000 | -1, 1.5, 10001 | idem | idem |
| `gracePeriodDays` | inteiro | 0 | 365 | -1, 2.5, 366 | idem | RF-40; teto técnico (pendência) |
| `suggestedMonthlyRateBps` | inteiro | 0 | 10000 | -1, 1.5, 10001 | idem | idem |
| `roundingStepCents` | inteiro | 1 | 100000 (R$ 1.000) | 0, -500, 500.5, 100001 | idem | RN-C12, `positiveCentsSchema`; teto técnico (pendência) |
| chaves | só as cinco | | | qualquer outra chave, campo ausente | idem | `strictObject` |

Os tetos são limites de sanidade, não regra de negócio; a pergunta ao PM está em `pendencias-pm.md` (E13-F01). Se o PM mandar outros valores, só o schema e `C14` a `C18` mudam.

## Critérios de aceite
- A1: `PUT` válido responde 200 com os cinco valores novos.
- A2: o `PUT` cria uma segunda linha em `default_terms`; a primeira não muda.
- A3: o `GET` seguinte devolve os novos valores.
- A4: dois `PUT` seguidos deixam o último como vigente.
- A5: cada mudança grava uma linha em `audit_log` com `before` e `after`, na mesma transação; falha da auditoria desfaz a nova linha.
- A6: contrato criado antes do `PUT` mantém multa, mora, carência e passo originais (ADR-0008, CA-10).
- A7: contrato criado depois do `PUT` traz os novos valores.
- A8: corpo inválido (campo ausente, negativo, não inteiro, acima do teto, chave desconhecida) dá 422 `VALIDATION_FAILED` no campo.
- A9: `PUT` igual ao vigente responde 200 sem linha nova e sem auditoria.

## Casos de teste
- C1 a C6: atualização (feliz, segunda linha, GET depois, dois PUT, resposta no formato do schema, carência 0 aceita).
- C7 a C9: auditoria (linha gravada, `before`/`after`, atomicidade).
- C10 a C13: contrato criado antes e depois (CA-10).
- C14 a C18: schema (campos válidos, ausente, negativo, não inteiro, passo 0, acima do teto, chave desconhecida).
- C19: PUT igual ao vigente.

## Arquivos de produção
- `packages/schemas/src/api/lending/update-default-terms.ts` (novo) e `packages/schemas/src/index.ts`: contrato.
- `apps/api/src/lending/application/loans-service.ts`: `updateDefaultTerms`.
- `apps/api/src/lending/http/default-terms.controller.ts`: `@Put("default-terms")`.
- `apps/api/src/lending/infra/default-terms-repository.ts`: insert e ordenação com desempate.

## Classificação TDD
Todos os arquivos acima são TDD. Sem dispensa.
