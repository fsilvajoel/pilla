# Refinamento funcional E9-F04

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato.
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e implementar sem adivinhar.

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T07 | ajustado | ajustado |
| E9-T08 | ajustado | ajustado |

## Veredito
ajustado

## Mudanças
- `docs/plano/E9.yaml` E9-T07: ampliou `refs`, `readFirst` e `allowedPaths`; corrigiu `done` para C1–C22, exclusão sem promoção, validação PIX e chave repetida.
- `docs/plano/E9.yaml` E9-T08: alinhou `allowedPaths`, `protectedTests`, `readFirst` e `checks` ao plano e à migration; incluiu remoção da UNIQUE e proteção dos testes SQL.
- `docs/plano/E9-F04/plano.md`: removeu descrições divergentes sobre promoção, validação por tipo e UNIQUE PIX, mantendo as decisões aprovadas do Joel.

## Pendências de PM
- nenhuma

## Revisão de consistência (20/11)
- Formato de `plano.md` alinhado ao dos planos commitados (`### A<n>:`, `- entrada:` sem negrito); comando de migration corrigido para `db:regen pix_keys_allow_repeat people` (o `db:generate` do pacote roda só o módulo `core`), no plano e no check do E9-T08.
- `E9.yaml`: E9-T07 `readFirst` apontava `packages/schemas/src/api/common.ts` (não existe); agora `packages/schemas/src/common.ts`; removido trecho redundante do `done`.
## Pendências
- Decisões do Joel de 20/11 citadas no plano (PIX repetido sem UNIQUE, exclusão do principal sem promoção, `PATCH {}` aceito) não estão registradas em `E9.md` nem em `pendencias-pm.md`; `E9.md` D9 e RFC-004 §2/§6 ainda exigem `If-Match`. Registrar antes da etapa tests.
- `address.ts` e `pix-key.ts` (e `index.ts` exportando-os) só existem no commit c1f5148 / branch `exp/e9-contracts`, não neste branch; o plano diz "não criar nem alterar schemas" e o E9-T08 não tem `packages/schemas` em `allowedPaths`. Trazer o commit c1f5148 antes da etapa tests ou abrir cartão para os schemas.
- Sem esboço de E9-F04 no repositório; a etapa tests precisa dele (o done do E9-T07 diz "fail against the sketch").
- RFC-005 §3 (remoção do `UNIQUE (type, value)`) entra no E9-T08, mas a RFC e o teste SQL `pix-keys.test.ts` ainda têm a regra antiga até lá.
