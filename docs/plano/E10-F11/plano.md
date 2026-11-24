# E10-F11: versão do contrato no detalhe, para o If-Match

Plano da feature. Cartão: E10-T19 (claude). Referências: RFC-004 §6 (concorrência), `docs/plano/E10.md` D9, `docs/plano/E10-F08/plano.md`, RN-C06.

## Escopo

Entra:
- `loanDetailResponse` ganha `version` (inteiro positivo), e `GET /loans/{id}` devolve a versão real da linha.
- O web lê `loan.version` e a envia em `If-Match` em ativar, cancelar e baixar (e, na F12, em editar). Some a versão inicial fixa que a F08 usava.
- Limpeza do que sobrar de versão fixa em `apps/web/lib/mock-data.ts`, só se o grep mostrar uso.

Fora: novos endpoints, mudança do formato do cabeçalho (`3` ou `"3"`, já aceito pelo controller), tela de edição (F12).

## Critérios de aceite
- A1: `loanDetailResponse` exige `version` inteiro positivo e recusa texto ou fracionado.
- A2: `GET /loans/{id}` devolve a versão gravada.
- A3: depois de um PATCH, a versão do detalhe sobe e ativar com ela responde 200.
- A4: ativar, cancelar e baixar com a versão do detalhe funcionam; com versão antiga dão 409 `VERSION_CONFLICT`.
- A5: o web não tem versão fixa nas chamadas de ativar, cancelar e baixar.

## Cenários
- C1 (A1): schema válido e inválido de `loanDetailResponse`.
- C2 (A2): detalhe de contrato novo traz `version` 1.
- C3 (A3, A4): editar e ativar em seguida; ativar com a versão anterior dá 409.
- A5 vira conferência por busca no código e pelo E2E (F10); tela sem teste nesta fase (emenda de 19/11 à ADR-0017).

## Contrato

Campo novo em `packages/schemas/src/api/lending/loan-views.ts`: `version: z.int().positive()` no `loanDetailResponse`. Cabeçalho de requisição `If-Match: <version>`; erro 409 `VERSION_CONFLICT` (RFC-004 §6). Nenhuma rota nova.

## Dependências

F08 (ações do web) e F03 (versão no PATCH). Destrava F12 e F10.

## Riscos
- Esquecer um ponto de envio do `If-Match` deixa a ação com 409 ou 428 sem causa clara; o grep do cartão cobre.
- Mudar o schema de resposta quebra consumidores do contrato (`pnpm check:schemas` roda no cartão).
