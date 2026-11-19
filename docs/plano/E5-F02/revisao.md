# Refinamento funcional E5-F02

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada): ajustado (A1 a A5 reescritos com camada e fonte).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato: ajustado (tabela criada).
- [ ] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam: contrato e dependências completados, mas a **casca não existe no HEAD** (ação do orquestrador, abaixo).

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E5-T05 | ajustado (readFirst ganhou o plano; `person-repository.ts` e a exclusão no vitest.config.ts ainda não existem) | ok |
| E5-T06 | ajustado (readFirst ganhou o plano; depende da mesma casca) | ajustado (assinaturas literais no `done`) |

## Veredito
ajustado (sem pergunta de PM bloqueante; três entradas abertas na fila são do `createPerson`, fora do escopo)

Condição para a etapa 2: o orquestrador criar a casca (arquivo com `// @stub E5-T06`, `NewPersonRow`, duas funções lançando, e a linha de exclusão em `coverage.exclude` do `apps/api/vitest.config.ts`) e o `estado.json` (`sources` = `person-repository.ts`, `domainSources` = [], `criteria` A1 a A5 unit, `tests`, `e2e` [], `stages.plan = done`, `stages.refinement` com `verdict` ajustado e `round` 1).

## Mudanças
- `docs/plano/E5-F02/plano.md`: seções Contrato, Domínio das entradas e Dependências reescritas; A1 a A5 no molde com camada; cenários com o critério (fonte: RFC-005 §3, RN-P01, RN-P02, PRD-001 RF-04, `core/public/audit.ts` para o tipo do db).
- `docs/plano/E5.yaml` E5-T05 e E5-T06: `readFirst` com o plano; E5-T06 `done` com as assinaturas literais (fonte: contrato do plano).
- `docs/plano/pendencias-pm.md`: três entradas (CPF duplicado, indicador inexistente, CPF obrigatório no cadastro).
- Observação: o `rejects.toThrow` do C3 é genérico; o erro exato (mensagem do PGlite/drizzle) não está provado e não foi inventado.

## Pendências de PM
- E5-T06: código de erro de CPF duplicado no `createPerson` (não bloqueia).
- E5-T06: erro de indicador inexistente no `createPerson` (não bloqueia).
- E5-T06: CPF obrigatório no cadastro novo (não bloqueia).

## Rodada 2
Respostas de PM aplicadas em `docs/plano/pendencias-pm.md` (409 `DUPLICATE_CPF`; 404 `NOT_FOUND` para indicador inexistente; CPF obrigatório e válido no cadastro, nulo só na importação). Não alteram o escopo da E5-F02: `createPerson` segue fora.
