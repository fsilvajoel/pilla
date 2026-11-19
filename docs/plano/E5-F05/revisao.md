# Refinamento funcional E5-F05

refinador: refiner (copilot)
rodada: 2

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (A1 a A14 na infra; A15 é da borda HTTP, fora desta feature).
- [x] Toda regra tem fonte; a tabela de domínio ganhou `search`, `limit`, `cursor` e `active`.
- [x] Contrato, arquivos e dependências bastam: `listPersons` com `PersonListQuery.active: boolean | null`; `PersonChanges.cpf` sem `null`.

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E5-T11 | ok | ajustado (C10: `null` limpa email, nascimento e notas; CPF intacto) |
| E5-T12 | ok | ok |
| E5-T13 | ok | ajustado (sem código HTTP novo para a autorreferência) |
| E5-T14 | ok | ok |
| E5-T15 | ajustado (desbloqueado) | ajustado (C11 a C15; C16 é da borda) |
| E5-T16 | ajustado (desbloqueado) | ajustado (busca, ordem, cursor, `active`) |

## Veredito
ajustado

## Mudanças
- `plano.md` (T15/T16): desbloqueio; contrato final de `listPersons` (busca por trecho sem caixa no nome e prefixo nos dígitos do CPF, ordem `lower(full_name)` e `id`, cursor opaco base64 JSON `{ fullName, id }`, `limit` padrão 20 e máximo 100 com 400 na borda, `active`); A7 a A9 sem "bloqueado"; A10 a A15; C8 a C16 (fonte: respostas de PM E5-T15, RFC-004 §2 e §6, RFC-005 §3).
- `plano.md` (T11): `PersonChanges.cpf` aceita só `string`; `referredById` e `active` fora; `null` limpa os opcionais (fonte: respostas de PM E5-T11).
- `plano.md` (A6/T13): "decidido: sem código na API"; `personWriteErrorCode` devolve `null` para 23514 (fonte: decisão do Joel, 19/11).
- `E5.yaml` T11, T13, T15, T16 e feature E5-F05: DoD e hints conforme acima; "BLOCKED" removido.
- `pendencias-pm.md` (feito pelo orquestrador, não pelo refiner): `limit` padrão 20 e autorreferência resolvida "sem código na API".

## Pendências de PM
- nenhuma aberta (as 8 da E5-F05 estão `resolvida`).

## Parecer do orquestrador (Claude)
Aceito: tudo acima. Observações, sem bloquear:
1. RFC-004 §2 ainda traz `limit=50` só como exemplo; o padrão 20 do Joel vive na borda (feature HTTP) e a RFC deve ser atualizada lá.
2. `active`: `null` e `true` fazem o mesmo (só ativas); não há valor para "todas". A resposta de PM diz "só ativas por padrão, com filtro para ver as outras", então `false` = só inativas. Se o Joel quiser "todas", é decisão nova.
3. `search` só com dígitos: o plano diz nome por trecho e CPF por prefixo, mas não diz que é união (OU). O T16 deve tratar como OU; A10/A11 testam com entradas que não colidem. Fonte: RF-04 ("nome ou CPF").
4. Respostas de PM sobre `null` que limpa e `cpf: null` recusado (T11), `limit` 400 e `?active=` (A15/C16) são regras da borda: ficam registradas no plano como fora da infra e não têm cartão de teste nesta feature. C16 e A15 não entram no estado.
5. O `done` do T11 "PersonChanges has no referredById/active/cpf null" é de tipo, não de execução; o typecheck cobre.
6. O refiner criou `refinamento.md` na pasta da feature (fora do escopo); o conteúdo foi consolidado aqui e o arquivo removido. Só uma chamada concluída ao refiner (a primeira, interrompida pela mudança de decisão do Joel, foi descartada sem aplicar nada).

## Confirmação do PM (19/11)
- O Joel confirmou as duas observações do refinamento: (1) `active: null` e `active: true` listam só ativas, sem valor para "todas"; (2) busca só de dígitos trata nome OU CPF (RF-04). Registrado em `plano.md`; os cenários C11 a C15 não mudam (nenhuma contradição).

## Revisão dos testes, rodada 1: reprovada
Reprovado o E5-T15 (`person-list.test.ts`): falsos positivos vêm dos dados dos cenários do plano, não do test-writer. Nenhuma regra nova; só dados de teste e um cenário que prova decisões já tomadas pelo Joel.

Bloqueantes
- B1 (A12, `lower` não provado): C13 passa a ter `"ana lima"` (...212) e `"Bruno Lima"` (...209); em collation C `B` < `a` inverteria a ordem. Esperado literal: ana lima, Ana Souza ...210, Ana Souza ...211, Bruno Lima.
- B2 (A12, desempate): C13 insere `"Ana Souza"` ...211 antes de ...210 (ordem física oposta ao esperado). CPFs explícitos e únicos (`39053344705`, `11144477735`, `52998224725`, e null em `"ana lima"`), pois o plano não os dizia e repetir CPF violaria `persons_cpf_key`.
- B3 (A11, prefixo parcial): C12 ganha `"529982"` (só Ana CPF ...207, não Bia CPF) e `"982247"` (meio do CPF, sem resultado).
- B4 (A10, trecho): C11 ganha `"SANTOS"` (só `"bia santos"` ...206).
- Gap dos dígitos (OU): novo critério A16 e cenário C17: `"Lote 529 Silva"` ...217 CPF `11144477735` e `"Ana CPF"` ...218 CPF `52998224725`; busca `"529"` devolve Ana CPF e depois Lote 529 Silva. A16 entrou em `estado.json` (`criteria`); a entrada do teste C17 em `tests` fica para quando existir teste.

Não bloqueantes
- N1: o `done` do E5-T15 já pedia `import type { PgliteDatabase } from "drizzle-orm/pglite"` (igual a person-repository.test.ts, person-update.test.ts e person-write-error.test.ts); o desvio é só do teste (`PgDatabase`, `PgQueryResultHKT`). Cartão não mudou no `done`; acrescentei um hint explícito proibindo PgDatabase/PgQueryResultHKT. A Bia corrige o teste.
- N2: fica, não bloqueia.
- N3: fica, não bloqueia.
- N4: o orquestrador atualiza no fim.

Cartões: E5-T15 com `done`/`hints` novos (C11, C12, C13, C17), `attempts` 8 (toolCalls 24, minutes 15); E5-T16 só com hints alinhados (C7-C15 e C17, OU dos dígitos, ordem `lower` com `id`).
