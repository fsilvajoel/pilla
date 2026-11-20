# ADR-0017 — Estratégia de testes: quando usar TDD e contrato primeiro

| Campo | Valor |
|---|---|
| Status | Proposto |
| Data | 2026-11-19 |
| Origem | Regras de teste do Joel (19/11); núcleo neutro no Ada (`capability/testing.md`, classificação TDD); [RFC-004](../rfc/RFC-004-api-e-eventos.md) (zod como fonte) |

## Contexto
O Ada exige TDD em tudo o que entra em `sources` (expect-red, cobertura de 100%, mutação no domínio). Isso pesa
em layout e em componentes do shadcn, que não têm regra própria e já são cobertos pelos testes das telas
(`apps/web/vitest.config.ts` exclui `components/ui/**`). Falta também ordem fixa para API: contrato, teste do
contrato, regra. O núcleo do Ada agora tem a classificação `tdd` / `dispensa-estilo` / `dispensa-biblioteca` e o
campo `exemptSources`; esta ADR diz como o pilla a aplica.

## Decisão
**Sem TDD** (dispensa no plano, com motivo):
- layout e estilo (Tailwind/CSS) sem condição nem cálculo: `dispensa-estilo`, revisão no navegador;
- componentes base do shadcn/Radix em `components/ui/**` sem comportamento alterado: `dispensa-biblioteca`.

**Com TDD** (teste antes, expect-red):
- formulários e validações (react-hook-form + schema zod): o schema e o hook são testados em Vitest;
- exibição condicional e cálculos: hook/função em Vitest; na tela, Testing Library por comportamento (texto,
  papel, estado visível), nunca por classe CSS;
- fluxos críticos do PRD: Playwright (`apps/web/e2e/*.e2e.ts`), mesmo quando as telas do fluxo são dispensadas;
- domínio (`packages/finance` e afins): unit + prop (fast-check) + mutação (Stryker, mínimo 80) desde o início.

**Fluxo de tela:** montar com shadcn e conferir no navegador → extrair a lógica para hook ou schema zod → teste
de comportamento da lógica antes de implementá-la.

**Contrato primeiro (API):**
1. Fase 1: o contrato é o schema zod em `packages/schemas`; tipos por `z.infer`. Teste de contrato em Vitest
   valida entrada e resposta com o schema (`safeParse` + `expect(r.success).toBe(true)`, regra Q3) antes da
   regra de negócio.
2. Fase 2: implementar com os tipos do schema. Domínio segue com TDD; só a cola de UI e composição pode ter o
   teste escrito depois de a estrutura assentar, e ainda assim antes do gate de cobertura.
3. Fase 3: Playwright nos fluxos críticos.

Payload nunca muda sem mudar antes o schema e o teste de contrato. Vitest para unidade e contrato; Playwright
para e2e.

## Consequências
- Positivas: menos teste frágil de layout; contrato único (zod) para API, tela e teste; a dispensa fica escrita
  e revisável, não implícita.
- Negativas: a revisão visual de telas dispensadas é manual; risco de esconder lógica numa tela dispensada (o
  reviewer reprova).
- Obrigatório: coluna "Teste" no plano para todo arquivo de produção; `exemptSources` no `estado.json`.

Pendências (não implementadas nesta ADR):
- `scripts/gates.mts` ainda não lê `exemptSources` (validar que não cruza com `sources` e que há motivo);
  hoje basta não listar o arquivo dispensado em `sources`;
- feature só de layout (nenhum arquivo `tdd`) falha em expect-red e cobertura: decidir se vira tarefa fora do
  workflow de feature;
- OpenAPI gerado do zod (`z.toJSONSchema` do zod 4 ou zod-openapi), conforme RFC-004;
- Supertest para teste de contrato de rota quando a camada HTTP (NestJS) existir;
- MSW (ou Prism) para mock da API no web, quando o web consumir a API real;
- comandos `e2e` (`pnpm --filter @pilla/web e2e`) e `contract` em `commands` do `harness.project.yaml`.

## Alternativas consideradas
- Orval / openapi-typescript gerando tipos do OpenAPI — inverteria a fonte da verdade (RFC-004: OpenAPI sai do
  zod); `z.infer` já dá os tipos.
- `toSatisfyApiSpec` (jest-openapi) — feito para Jest; o `safeParse` do próprio schema prova o mesmo em Vitest
  sem dependência nova.
- Unitário só depois de estabilizar, para tudo — tiraria o expect-red do domínio, onde o erro custa dinheiro.
- TDD em tudo, inclusive layout — teste de classe CSS quebra a cada ajuste visual e não prova comportamento.
