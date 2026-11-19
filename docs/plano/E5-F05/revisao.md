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
