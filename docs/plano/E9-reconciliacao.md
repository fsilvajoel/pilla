# E9: reconciliação do estado (23/11/2026)

Status do E9 passou de 15% para 51% (0/13 features fechadas). Só entrou em `estado.json` o que tem commit real, teste verde conferido hoje ou revisão com veredito. Etapa sem prova ficou `pending`.

Testes rodados em 23/11 (só as pastas relevantes): `apps/api` core/http, app e people (22 arquivos, 341 testes); `packages/schemas` src/api (20 arquivos, 592); `apps/web` lib/api, pessoas e components/people (16 arquivos, 112); `tsc --noEmit` do web limpo; `db:migrate` e `db:seed` duas vezes cada no Postgres dev (idempotentes, 6/8/8).

| Feature | Etapa comprovada | Evidência | Lacuna | Ação sugerida |
|---|---|---|---|---|
| F01 banco dev (T01) | plan, refinement, implement | 216c191; migrate/seed 2x ok; check-allowed-deps ok | sem revisão final; `check-env-example` acusa `PILLA_COOKIE_SECURE` só no `.env` (fora do E9) | revisão final; sincronizar `.env.example` |
| F02 base API (T02, T03) | plan, refinement, tests, implement | 884b61b, bb1ec4c, b8d0e66; 8 arquivos de teste verdes; `docs/plano/E9-F02/revisao.md` é só do refinamento | gate expect-red FAIL é antigo (anterior à implementação); sem revisão dos testes e sem revisão final | revisar testes; rodar gates e revisão final |
| F03 rotas de pessoas (T04, T05, T06) | plan, refinement, tests, implement | 237dd27, 2af0968, 8f3ec0d, 16898f6; people.http (51) e people.test verdes | sem revisão dos testes e sem revisão final | revisar testes; revisão final |
| F04 endereços e PIX (T07, T08) | plan, refinement, tests, implement | 67c162f, f2a453c; addresses.http (70), pix-keys.http (53), infra/pix-keys (12) verdes | mutação (A3, A7) não rodada; sem revisão dos testes e final | mutação; revisar testes; revisão final |
| F05 ficha (T09, T10) | plan, refinement, tests, implement | f78114a, 1170269; person-sheet.http (10) verde | sem revisão dos testes e final | revisar testes; revisão final |
| F06 design system (T11, T13) | plan, refinement, implement | ad5f2b7, 75b1a12, 6b34dc2; tsc do web ok; sem teste por ADR-0017 | revisão visual não registrada | revisão visual no navegador |
| F07 cliente API (T15) | plan, implement | 0328b49; lib/api/people.test.ts verde | sem refinamento formal; sem revisão | revisão |
| F08 lista (T17) | plan, implement | e46e4ed | sem refinamento formal; revisão visual não registrada | revisão visual |
| F09 cadastro e edição (T19) | plan, implement | só no merge 340ff7f (sem commit atômico); person-form-request.test verde | sem refinamento formal; revisão visual não registrada | revisão visual |
| F10 ficha web (T21) | plan, implement | 0d33997, 8d134ba | sem refinamento formal; revisão visual não registrada | revisão visual |
| F11 e2e (T22) | plan, tests, implement (nota) | 01cecb3 (`people.spec.ts`) | spec nunca executada nem registrada como verde; sem revisão | subir API, Postgres e web e rodar `pnpm --filter @pilla/web e2e` |
| F12 link morto (T23) | plan, implement | dce0924 | sem refinamento formal; sem revisão | revisão |
| F13 erros nos dialogs (T24) | plan, implement | ed96f50, 402a142, 5acf404; actions.test verde | sem refinamento formal; sem revisão | revisão |

## Cartões que realmente faltam

Nenhum cartão de implementação ou de teste falta: T01 a T11, T13, T15, T17, T19, T21 a T24 têm commit (T12, T14, T16, T18 e T20 foram removidos em 19/11). Faltam etapas de qualidade:

1. Revisão dos testes: F02 (T02), F03 (T05), F04 (T07), F05 (T09), F11 (T22).
2. Revisão final e fechamento: as 13 features.
3. Gates: expect-red de F02 a regravar; mutação de F04; e2e de F11 executado.
4. Revisão visual: F06 a F10.
5. Refinamento funcional formal: F07 a F13 (sem `plano.md` próprio).
6. Sem commit atômico: T19 (F09) só existe no merge 340ff7f.

Nota: `tests` e `testReview` foram removidos do estado de F06 e `tests` marcado `skipped` em F01 porque não há cartão de teste (emenda de 19/11 à ADR-0017); isso evita bloquear a conta do status.py sem marcar revisão que não houve.
