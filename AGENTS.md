# AGENTS.md — Guia para agentes construtores do pilla

Vale para **todo agente** que escreve código aqui.
Documentação e comentários de código em pt-BR; código em inglês ([ADR-0012](docs/adr/0012-idioma-codigo-ingles-docs-portugues.md)).

> Princípio: **documento orienta, máquina obriga.** Toda regra importante tem uma trava automática (teste, tipo, lint, CI), detalhada em [docs/travas.md](docs/travas.md) com a coluna de quando ela fica ativa.

---

## 1. Antes de qualquer tarefa

1. Leia [docs/README.md](docs/README.md), o [glossário](docs/glossario.md) e os documentos citados na tarefa.
2. Leia a [memória do projeto](docs/memoria/README.md) (lições e ficha do módulo) antes do código.
3. Só implemente o que está em PRD/RFC **Aprovado** e ADR **Aceito**.
4. **Nunca invente.** Não sabe como uma biblioteca funciona? Siga §7 (documentação oficial ou pergunta). Código baseado em suposição é rejeitado na revisão.
5. Encontrou conflito ou lacuna nos documentos? **Pare e pergunte.** Não decida regra de negócio.

## 2. Papéis

**Joel** decide produto e arquitetura, aprova docs e PRs e faz merge. Os papéis dos agentes são subagentes do Claude Code em [.claude/agents/](.claude/agents/) (planner, test-writer, reviewer, implementer); a sessão principal é o orquestrador e segue o [workflow feature](Harness-adaV1/workflow/feature.md).

## 3. Fluxo de trabalho

O fluxo de uma feature (plano → testes → revisão dos testes → implementação → auditoria → revisão final), com gates e artefatos, é o [workflow feature do Harness-adaV1](Harness-adaV1/workflow/feature.md). Testes vêm **antes** do código, são escritos e revisados por quem **não** implementa, e quem implementa não altera teste.

## 4. Comandos de verificação

Os comandos do projeto (teste, cobertura, typecheck, lint, fronteiras, esquemas, `pnpm verify`) ficam no bloco `commands:` de [Harness-adaV1/harness.project.yaml](Harness-adaV1/harness.project.yaml).

## 5. Contexto e memória

- **Memória curada** em [docs/memoria/](docs/memoria/README.md): lições, colas e fichas de módulo, com curadoria antes do commit.
- Nada de IP, senha, token ou dado pessoal na memória (repositório público).

## 6. Estrutura e convenções

Estrutura: [RFC-003 §4.1](docs/rfc/RFC-003-stack-tecnologica.md). Cada módulo da API:

```
modules/<module>/
  public/   # única porta de entrada para outros módulos (serviços, tipos, eventos)
  domain/   # entidades, regras, máquina de estados — TS puro
  infra/    # repositórios Drizzle, schema do banco do módulo
  http/     # controllers e DTOs (Zod de packages/schemas)
```

- Nomes: [glossário](docs/glossario.md). Termo novo entra no glossário antes do código.
- Dinheiro, taxas, datas, erros e eventos: [RFC-004 §2](docs/rfc/RFC-004-api-e-eventos.md).
- Erros de domínio: classes com `code` do catálogo (RFC-004 §6); texto pt-BR só no arquivo de mensagens.
- Um arquivo, uma responsabilidade; funções puras sempre que possível.
- Comentário explica **por quê**, não o quê; cite o ID da regra (`// RN-C03`).

## 7. Dúvidas: documentação oficial ou pergunta (nunca invenção)

Ordem obrigatória quando faltar conhecimento:

1. **Documentos do projeto** (`docs/`, código vizinho).
2. **Documentação oficial**, conforme [Harness-adaV1/policy/research.md](Harness-adaV1/policy/research.md).
3. **Pergunta** ao orquestrador (e, se preciso, ao Joel), objetiva e com o trecho mínimo.

Regra de negócio nunca é pesquisada na web.

## 8. Definição de pronto

- [ ] Testes da feature passam; nenhum teste alterado por quem implementou.
- [ ] `typecheck`, `lint`, fronteiras (dependency-cruiser), cobertura e (em `finance`) mutação dentro dos mínimos. O código já nasce seguindo o lint: as regras, com exemplo errado e certo, estão em [docs/memoria/lint.md](docs/memoria/lint.md).
- [ ] Sem `any`, `@ts-ignore`, `eslint-disable`, `.only/.skip`, `console.`, TODO sem ID.
- [ ] Nenhum arquivo fora do escopo do plano da feature; nenhuma dependência nova.
- [ ] Nomes conforme glossário; textos pt-BR no arquivo de mensagens.
- [ ] IDs das regras citados no código (onde a regra é aplicada) e no PR.
- [ ] Docs atualizados se o comportamento mudou.

## 9. Commits e PRs

- Commit: inglês, Conventional Commits (`feat(lending): generate installment schedule`), cita IDs no corpo.
- PR: título em inglês; corpo em pt-BR (o que, por quê, IDs, como testar, riscos).
- Nunca comitar `.env`, dados reais, arquivos gerados ou `runs/`.

## 10. Nunca

- `float` para dinheiro; segredo no código; dado pessoal real em teste ou log.
- Ler/escrever tabela de outro módulo; chamar o interior de outro módulo.
- Editar ADR aceita (cria-se outra que substitui), teste protegido ou trava para "fazer passar".
- Inventar comportamento de biblioteca ou regra de negócio.
- Push direto na `main`.
