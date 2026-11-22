# E12-F05: cliente web e telas da tesouraria

Plano da feature. Cartões: E12-T14 (cliente web, claude Sonnet) e E12-T09 (telas, claude Sonnet). Referências: PRD-001 RF-30 a RF-32 e RN-C10, RFC-004 §3, ADR-0013, ADR-0017 (emenda: sem teste novo de tela), `docs/plano/E12.md` D4 a D7 e D9, `docs/plano/E11-F05/plano.md` (padrão de cliente e tela), `docs/plano/pendencias-pm.md` (E12-T09).

## Escopo

Entra:
- Cliente `apps/web/lib/api/treasury.ts` (novo): `listAccounts`, `createAccountEntry` (com `Idempotency-Key`),
  `getAccountStatement` e `getTreasurySummary`, validando as respostas com os schemas de `@pilla/schemas` (mesmo padrão
  de `lib/api/payments.ts`).
- Rota `/caixa` (`apps/web/app/(admin)/caixa/`):
  - topo: cartões do painel (caixa, emprestado, % comprometido e disponível, juros e encargos recebidos no mês,
    recuperado no mês, perdas, previsão do mês); percentual nulo mostra "—"; seletor de mês;
  - extrato da conta base: tabela com data, tipo, componente, valor (verde/vermelho conforme o sinal), saldo após e
    justificativa; filtro de período; "Carregar mais" pelo `nextCursor`; saldo inicial e final do período;
  - botão "Novo lançamento": diálogo com tipo (Aporte, Retirada, Ajuste), valor, data (padrão hoje em Brasília) e
    justificativa (obrigatória no ajuste; no ajuste há sinal "Entrada"/"Saída"); envia com uma `Idempotency-Key` por
    abertura do diálogo; ao gravar, recarrega painel e extrato.
- Menu: item "Caixa" em `admin-nav.tsx`.
- Aviso RN-C10 (D6): no diálogo "Ativar" do contrato (`loan-draft-actions.tsx`), lê o saldo da conta do contrato em
  `GET /accounts`; se o principal é maior, mostra "O caixa registrado (R$ X) é menor que o valor do contrato (R$ Y).
  Você pode ativar mesmo assim." e mantém o botão de confirmar habilitado (texto padrão, pendência de PM).
- Rótulos pt-BR dos tipos e componentes em `apps/web/lib/labels.ts`.

Fora: tela de contas e cadastro de conta; editar ou apagar lançamento; gráficos; teste novo de tela (emenda da
ADR-0017).

## Domínio das entradas

| Entrada | Formato | Mínimo | Máximo | Rejeitados | Erro | Fonte |
|---|---|---|---|---|---|---|
| tipo | Aporte, Retirada, Ajuste | - | - | - | - | RF-30 |
| valor | moeda pt-BR → centavos | R$ 0,01 | limite de `positiveCentsSchema` | 0, vazio, texto | mensagem no campo | ADR-0004 |
| data | data | - | hoje em Brasília | futura | mensagem no campo (a API também recusa) | D4 |
| justificativa | texto | 1 caractere útil (ajuste) | limite do `reasonSchema` | vazia no ajuste | mensagem no campo | RF-30 |
| período do extrato | duas datas | - | - | início > fim | mensagem no filtro | D5 |
| mês do painel | mês/ano | - | - | - | - | D7 |

## Critérios de aceite

- A1: `/caixa` abre com o painel e o extrato da conta base vindos da API; estados de carregando, vazio
  ("Nenhum lançamento no período.") e erro.
- A2: "Novo lançamento" grava aporte, retirada e ajuste; o extrato e o painel mostram o novo saldo; erro da API aparece
  em pt-BR no diálogo.
- A3: valor negativo aparece em vermelho com sinal; saldo após em cada linha.
- A4: filtro de período e "Carregar mais" funcionam.
- A5: o menu tem "Caixa".
- A6: ativar contrato com principal maior que o caixa mostra o aviso e deixa ativar; com caixa suficiente, sem aviso.
- A7: cliente valida as respostas com os schemas; nenhum `any`.

## Dependências

E12-T04, E12-T06 e E12-T08 (API); E10-T16 (diálogo de ativar); E9-T15 (componentes compartilhados). Destrava F06.
