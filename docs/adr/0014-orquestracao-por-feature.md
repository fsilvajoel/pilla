# ADR-0014 — Orquestração por feature (Claude planeja e revisa, Bia testa e audita, Alice implementa)

| Campo | Valor |
|---|---|
| Status | Substituída por [ADR-0015](0015-harness-ada-externo-agnostico.md) |
| Data | 2026-11-16 |
| Origem | Pedido do Joel (16/11); medições do E4-T03 em [docs/estudo/fatos.md](../estudo/fatos.md) |

## Contexto
O harness da Alice roda por cartão. No E4-T03 o Claude ficou no laço entre rodadas (330 turnos, ≈5M tokens, 64%
releitura), a Alice não conseguiu escrever o teste em 10 rodadas, a pré-revisão local reprovou sem nota com apoio
no pronto e a Bia foi chamada por cartão e por rodada, contra uma cota de 50 requisições por dia.

## Decisão
- A unidade de orquestração passa a ser a **feature**: um grupo de cartões declarado em `features:` no plano YAML,
  com um `plano.md` escrito pelo Claude e um orçamento de requisições da Bia (`biaBudget`).
- Papéis fixos: o Claude planeja (etapa 1) e aprova (etapa 5); a Bia escreve todos os testes da feature numa
  chamada (etapa 2) e audita a entrega numa chamada (etapa 4); a Alice implementa localmente (etapa 3).
- Toda troca passa pelo orquestrador (`alice.py feature`), em JSON com esquema fixo por papel; saída fora do
  esquema tem uma nova tentativa e depois vira `error`.
- A auditoria da Bia sobre o próprio teste se apoia em números mecânicos (expect-red, cobertura, checks); a
  aprovação final independente é do Claude, no commit com `Card-Done`.
- A pré-revisão local continua como filtro opcional e não bloqueia sozinha: reprovação sem nota com apoio no
  pronto é inconclusiva.

## Consequências
- Positivas: 2 a 4 requisições da Bia por feature; o Claude entra 2 vezes por feature; artefatos de cada etapa
  em `docs/plano/<F>/`.
- Negativas: a Bia escreve e audita o mesmo teste (mitigado acima, registrado em travas.md 4.9); um teste ruim só
  é barrado pela auditoria mecânica ou pelo Claude.
- Obrigatório: `alice.py cards` valida a feature; o orquestrador nunca commita; cartões fora de `features:`
  seguem o fluxo antigo (`plan-run`).

## Alternativas consideradas
- Plano YAML = feature — o E4 tem duas features (fakeCpf e redact) e uma já está pronta; `features:` é o mínimo.
- Bia revisando por cartão como hoje — gasta 5+ requisições por cartão de teste.
- Alice escrevendo teste — 10 rodadas sem aprovação no E4-T03.
