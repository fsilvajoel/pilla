# Revisão dos testes E5-F05, rodada 2: aprovada (assinatura pendente de correção de estado)

revisor: reviewer
testes: `person-update.test.ts` (C1-C4, C10), `person-write-error.test.ts` (C5, C6, C18), `person-list.test.ts` (C7, C8, C11-C15, C17, C19)

Gates: `expect-red` PASS (23 testes, todos falhando contra o stub); `typecheck` PASS; `lint` PASS; `check-test-quality` ok nos 3 arquivos. Imports e `done` de T11, T13 e T15 batem; nada fora de `allowedPaths`; CPFs distintos em cada cenário; esperados literais; só banco (PGlite) e API pública.

## Cobertura por cenário
- C1: version 3 a 4, `updated_at` sem `2026-01-01`, `active` true, `referred_by_id` null. C10: `null` limpa email/birth_date/notes, CPF e nome intactos. C2 NOT_FOUND. C3 VERSION_CONFLICT com linha intacta. C4 rejeita com `cause.code`/`cause.constraint`.
- C5 (4 casos), C6 (erro real 23514 com metadata conferida antes do `null`), C18 (4 ramos do narrowing).
- C7 item exato com cpf null; C8 vazio; C11 `BIA` e `SANTOS` (Ana Costa tem CPF, então impl que trata busca sem dígito como prefixo vazio de CPF reprova); C12 `529.982.247-25`, `529982`, `982247`; C13 ordem física oposta e collation C; C14 três linhas com ordem por nome oposta à ordem por id, limit 1, três páginas, última `nextCursor: null`; C15; C17 OU; C19 quatro cursores.

## Bloqueante
- B1 (estado, não de teste): `pnpm gate tests-reviewed E5-F05` falha com "A13: sem scenario da camada unit com arquivo em `tests`". Em `estado.json` o cenário C14 aponta só `criterio: "A9"`; o A13 (keyset) está em `criteria` sem cenário. Correção: acrescentar ao `scenarios` uma entrada `{ id: "C14", criterio: "A13", camada: "unit", arquivo: ".../person-list.test.ts", teste: <mesmo nome do C14> }` (ou mapear o C14 aos dois critérios). Feito isso, rodar `pnpm gate tests-reviewed E5-F05 --sign`. A15 já está fora de `criteria`.

## Não bloqueantes
- N1 (`person-write-error.test.ts:25-33`): sem caso com `code` trocado e `constraint` certo (ex.: `{code:"23503", constraint:"persons_cpf_key"}`); uma impl que olhe só `constraint` passa. O plano não pede.
- N2 (`person-list.test.ts` C14): nenhum empate de `lower(full_name)` cruza a fronteira de página; keyset só por `lower(full_name) > nome` (sem `id`) passa. O desempate só é provado numa página (C13). Idem cursor combinado com `search`/`active`.
- N3 (C19): cursor de JSON válido que não é objeto (`null`, `"123"`) e `id` não string não estão; impl que lance TypeError para `null` passaria no `toThrow` apenas se a mensagem contiver "invalid cursor" (não passa), mas o ramo fica sem prova. "Sem consultar o banco" não é assertado.
- N4 (C1): `updated_at` só prova "mudou", não "now()"; aceitável pelo plano.
- N5: o cursor é opaco no teste, então um cursor por OFFSET passaria; o plano proíbe decodificar.

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

## Revisão dos cartões (Opus), rodada 1

Veredito por cartão: T11 aprovado com ajustes (não bloqueantes); T12 aprovado com ajuste; T13 reprovado (B1); T14 ajustado junto com T13; T15 reprovado (B2); T16 reprovado (B3, B4).

Bloqueantes
- B1 (T13/T14, ramos falsos do narrowing sem teste): cenário novo C18 (A5) e `done` do T13 com `personWriteErrorCode(null)`, `("texto")`, `({ cause: null })` e `({ cause: "x" })`, todos `null`, além do `{}` e dos erros reais; `sizeNote` do T13 passa a nove testes; hint do T14 alinhado a esses casos, sem `any`.
- B2 (T15/C14, keyset não provado): C14 reescrito e fundido com o C9: três linhas em que a ordem por `lower(full_name)` discorda da ordem por `id` (Bia Nunes 0219, Davi Melo 0214, Eva Reis 0213), `limit` 1, todas as páginas até `nextCursor` nulo, sequência completa sem repetição nem falta, cursor opaco (só repassado, nunca decodificado). C9 removido (A9 provado no C14).
- B3 (T16, `done` vago): `done` e hints com a comparação `(lower(full_name), id) > ($nome, $id)` com o nome já em minúsculas, cursor base64 de JSON `{fullName, id}` com `fullName` em minúsculas, `limit + 1` linhas lidas, `digits === ""` sem condição de CPF, escape de `%`, `_` e `\` no `LIKE`, decodificação sem `any` com validação de forma, `async` e imports de `drizzle-orm` e `./schema`.
- B4 (T16, contexto): `schema.ts` e `person-repository.ts` no `readFirst`; `budget.attempts` 8.

Não bloqueantes (aplicados)
- T11: C1 e C10 com `version` 3 na linha inicial, chamada com 3 e resultado 4 (plano e cartão); `sizeNote` com cinco testes (C1 a C4 e C10); "`PersonChanges` sem `cpf` null" saiu do `done` e foi para os hints.
- T12: `done` diz `async` e que `import { persons } from "./schema"` convive com o `import type { NewPersonRow }`.
- T15: hint do C12 diz "remove tudo que não é dígito"; `sizeNote` com oito cenários (C7, C8, C11 a C15 e C17; o C14 reescrito absorve o C9); `attempts` 8 mantido.

Pendente de decisão do Joel
- Q2: cursor malformado (base64 inválido, JSON inválido ou forma errada). Opções: (a) erro na infra, com cenário novo no T15; (b) tratar como sem cursor; (c) borda HTTP. Recomendação: (a) erro na infra com cenário novo no T15. Nada disso está escrito nos cartões; o T16 só exige validação de forma na decodificação.

Decisões aplicadas
- Q1: o cursor guarda o nome já em minúsculas; a comparação do keyset usa esse valor contra `lower(full_name)`.
- Q3: os testes tratam o cursor como opaco (só repassam o `nextCursor` recebido).

Estado: os testes serão refeitos pela Bia; `scenarios`/`expect-red` do `estado.json` serão regerados após a nova rodada (T11, T13 com C18, T15 com C14 novo). Nenhuma entrada de teste foi inventada; as existentes ficam como estão (a entrada do C9 deixa de valer).

## Decisão do Joel (19/11): Q2 = a

Cursor malformado lança `Error("invalid cursor")` na infra; a borda HTTP traduz para 400 `VALIDATION_FAILED` depois (fora desta feature). Mudou: critério A17 e cenário C19 no plano (quatro cursores literais: `"abc"`, `"bm90IGpzb24="`, `"eyJmdWxsTmFtZSI6ImFuYSJ9"`, `"eyJmdWxsTmFtZSI6MSwiaWQiOiJ4In0="`); linha do cursor na tabela de domínio; T15 com o C19 no `done` (nove cenários, nove testes); T16 com a validação do cursor no `done` e hint de narrowing sem `any`; A17 em `estado.json`; pergunta resolvida em `pendencias-pm.md`. O T15 precisa ser refeito pela Bia.
