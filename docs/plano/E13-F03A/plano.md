# E13-F03A: web, formulário de parâmetros padrão

Plano da feature. Cartão: E13-T05 (tela, claude): leva `shadcn` e `tailwind-css`. Referências: PRD-001 RF-40 e RF-41, ADR-0013, `docs/plano/decisoes-2026-11-19.md`, `docs/plano/E13.md` D5, D6, D8 e D10, `docs/plano/E10-F08/plano.md`. Sem teste automatizado nesta fase (emenda da ADR-0017); a revisão é visual e a cobertura vem do E2E (F04A).

## Dependência
Depende só da F01 (`PUT`), do cliente base da E10-T15 e do shell da E9-T13. Roda em paralelo à E11 e ao painel.

## Escopo

Entra:
- `apps/web/lib/api/settings.ts`: `getDefaultTerms` e `updateDefaultTerms`, sobre o wrapper da E9-T15, parseados com os schemas.
- `/configuracoes`: formulário com os cinco campos do RF-40, pré-preenchido pelo `GET`:
  - multa por atraso (%), juros de mora (% ao mês), taxa de juros sugerida (% ao mês): campo em % que converte para bps;
  - dias de carência: inteiro;
  - passo de arredondamento (R$): campo em reais que converte para centavos (padrão R$ 5).
- Server Action que chama o `PUT`; sucesso mostra "Parâmetros atualizados."; 422 mostra a mensagem ao lado do campo.
- Aviso fixo sob o formulário: a mudança vale só para contratos criados daqui em diante; os existentes mantêm os seus (ADR-0008).
- Item "Configurações" no menu lateral (`admin-nav.tsx`).

Fora: histórico de vigências; ajuste por contrato (já na E10-F08, RF-41).

## Critérios de aceite
- A rota abre com os valores vigentes.
- Salvar chama o `PUT` e mostra a confirmação; recarregar mostra os novos valores.
- Conversões sem ponto flutuante na requisição (inteiros em bps e centavos).
- Estados de carregando, erro e validação aparecem.
- Menu tem "Configurações" e marca a rota ativa.
- Sem erro no console. Typecheck e lint passam.
