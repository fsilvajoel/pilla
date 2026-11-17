# AGENTS.md — Guia para agentes construtores do pilla

Vale para **todo agente** que escreve código aqui: Claude (tech lead), Alice (modelo local) e qualquer outro.
Documentação e comentários de código em pt-BR; código em inglês ([ADR-0012](docs/adr/0012-idioma-codigo-ingles-docs-portugues.md)).

> Princípio: **documento orienta, máquina obriga.** Toda regra importante tem uma trava automática (teste, tipo, lint, CI ou o ambiente da Alice), detalhada em [docs/agents/travas.md](docs/agents/travas.md) com a coluna de quando ela fica ativa.

---

## 1. Antes de qualquer tarefa

1. Leia [docs/README.md](docs/README.md), o [glossário](docs/glossario.md) e os documentos citados na tarefa.
2. Leia a [memória do projeto](docs/memoria/README.md) (lições e ficha do módulo) antes do código.
3. Só implemente o que está em PRD/RFC **Aprovado** e ADR **Aceito**.
4. Toda tarefa tem um **cartão de tarefa** ([cartão](docs/agents/cartao-de-tarefa.md)). Sem cartão, não comece.
5. **Nunca invente.** Não sabe como uma biblioteca funciona? Siga §7 (documentação oficial ou pergunta). Código baseado em suposição é rejeitado na revisão.
6. Encontrou conflito ou lacuna nos documentos? **Pare e pergunte.** Não decida regra de negócio.

## 2. Papéis

| Quem                   | Faz                                                                                                                                                                                    | Não faz                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Joel**               | decide produto e arquitetura; aprova docs e PRs; faz merge                                                                                                                             | —                                                                                      |
| **Claude** (tech lead) | recorta tarefas em cartões claros e conferíveis; escreve **assinaturas, testes e travas**; arquitetura, segurança, integração entre módulos; responde dúvidas da Alice; revisa; comita | ficar no meio do ciclo de tentativa e erro da Alice                                    |
| **Alice** (local)      | implementa até os testes passarem; código repetitivo; rascunhos de docs/PR; resumos; pesquisa em docs oficiais                                                                         | alterar testes, configs, docs aprovados, dependências; segurança/autenticação; comitar |

### Economia de tokens do Claude (regra de operação)

- O ciclo **tentar → testar → corrigir** roda no ambiente da Alice (GPU local); o Claude só recebe o **resultado aprovado** pelas travas.
- O retorno ao Claude é **compacto**: status, testes, arquivos, linhas, perguntas. Nunca o histórico da Alice.
- Pedidos à Alice apontam **caminhos de arquivo**; conteúdo não é colado na conversa do Claude.
- Leitura e resumo de arquivos/logs grandes: delegue à Alice; o Claude lê só o necessário.
- Revisão proporcional ao risco ([revisão](docs/agents/revisao.md)).
- Cada execução registra tokens da Alice; acompanhamos a economia por tarefa.

## 3. Fluxo de trabalho

### 3.1 Ciclo de desenvolvimento (sprint) — definido pelo Joel em 16/11/2026

| #   | Etapa                                        | O que sai                                                                                                             | Quem                                                                       |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **Planejamento**                             | PRD, ADR, RFC e demais documentos aprovados                                                                           | Joel decide; Claude redige                                                 |
| 2   | **Refinamento técnico**                      | cartões no tamanho da Alice (`alice.py cards` verde) e cenários de teste de cada feature, citando as regras (CA/T/RN) | Claude fatia; Bia detalha os cenários                                      |
| 3   | **Desenvolvimento**                          | primeiro os testes, depois o código (`alice.py feature`)                                                              | Bia escreve os testes; Alice escreve o código                              |
| 4   | **Validação/review**                         | checks verdes, auditoria e revisão do que foi gerado                                                                  | portões do harness, Bia (testes), Claude (revisão final)                   |
| 5   | **Entrega**                                  | commit, push e PR                                                                                                     | Claude comita; Joel aprova e faz merge                                     |
| 6   | **Retrospectiva + ajustes + próxima sprint** | retro por feature, custo (Claude × Alice × Bia), ajustes do processo e do harness, plano da sprint seguinte           | retro: harness/Claude; harness: **Claude** (dono); plano: Joel + Claude    |

Regras do ciclo:

- Feature só entra em Desenvolvimento com todos os testes da Bia prontos e revisados; daí a Alice pega os cartões dela e o pipeline segue para a próxima feature.
- Problema de processo ou de harness achado em qualquer etapa é anotado para o Claude, dono do harness desde 17/11, que trata no fim da leva; quem acha não conserta no meio da entrega.

### 3.2 TDD dentro do Desenvolvimento

```
1. Claude: cartão de tarefa + assinaturas (tipos/interfaces, corpo `throw new Error('not implemented')`)
2. Bia: testes que falham, cada um citando o ID da regra (CA-xx, T-xx, RN-xx), revisados por ela
3. Harness: commit "test: ..." da feature  → os testes ficam PROTEGIDOS
4. Alice: implementa no ambiente dela até a verificação completa passar (§8)
5. Alice: dúvida → docs oficiais ou ask_claude (§7)
6. Ambiente: verificação final + checagem do diff → relatório compacto ao Claude
7. Claude: revisão ([revisão](docs/agents/revisao.md)) → commit "feat: ..." com Co-Authored-By da Alice → PR
8. Joel: aprova e faz merge
```

Testes vêm **antes** do código e são escritos por quem **não** implementa. Quem implementa não altera teste.

## 4. Tipos de tarefa e caminho da Alice

**Código no repositório só entra pela Alice via `alice-harness`** (`alice.py run <cartão> --repo .`), inclusive quando disparada pelo Claude do Windows. Chamada direta ao modelo (`chat`/curl) serve só para resumo e rascunho de texto. Assim valem sempre as travas de [docs/agents/travas.md](docs/agents/travas.md).

| `kind` do cartão     | Alice faz                                                                                       | Escreve em                    |
| -------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| `implement` (padrão) | implementa → testa → corrige → refatora → lint → verifica                                       | `allowedPaths` (código)       |
| `test-author`        | rascunha testes a partir dos IDs; o Claude revisa antes do commit                               | arquivos de teste do cartão   |
| `pre-review`         | revisa o diff em sessão nova contra cartão e glossário; só relata                               | nada                          |
| `docs`               | rascunha ficha de módulo, corpo de PR, lições                                                   | `docs/memoria/**` do cartão   |
| `cards`              | rascunha cartões a partir das tabelas das RFCs                                                  | `docs/plano/**`               |
| `research`           | pesquisa em documentação oficial, só com bom motivo ([cartão](docs/agents/cartao-de-tarefa.md)) | um resumo em `docs/pesquisa/` |

**Tarefa da Alice é pequena** (lições LI-011/012/013, conferidas pelo `alice.py cards`):

- no máximo **2 arquivos** em `allowedPaths` e **30 chamadas** de ferramenta; uma função por cartão;
- arquivo grande é escrito em partes; saída grande (vários cartões, documento longo) é gerada **por partes em modo texto** e montada por script;
- critérios de pronto e o que exige fidelidade ao plano são escritos pelo Claude, ancorados no ID da regra;
- `pre-review` sempre com `checklist` fechado: uma linha por item com evidência; "ok" sem prova exata é erro. Pré-revisão é filtro, não aprovação.

**Enquanto a Alice roda, ninguém edita o repositório** (LI-009): antes de editar, `alice.py status`. Fila de cartões: `alice.py plan-run docs/plano/E1.yaml <IDs>` (pula dependentes de falhas).

**Cartão mal escrito é erro de quem escreveu, não de quem executou.** Formato e as regras para quem planeja (o que vai no `done`, nos `checks` e no `hints`): [docs/agents/cartao-de-tarefa.md](docs/agents/cartao-de-tarefa.md). Antes da fila, `alice.py cards <plano> --repo .` sem problemas; o `run` ainda faz um pré-voo e devolve `card_error` sem gastar o modelo.

## 5. Contexto e memória

- **Regra por ID, não por arquivo:** o cartão lista `rules: [RN-C03, T-13]`; o harness injeta só essas definições. O Claude busca uma regra com `alice.py rule <ID> --repo .` em vez de abrir PRD/RFC inteiros.
- **Orçamento:** a leitura de uma tarefa da Alice cabe em ~20 mil tokens; arquivo grande é lido por trecho.
- **Memória curada** em [docs/memoria/](docs/memoria/README.md): a Alice devolve até 3 `lessons` no `finish`; o Claude faz a curadoria e comita. Resposta a `ask_claude` que sirva para outras tarefas vira lição.
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
2. **Documentação oficial** via `web_search` + `fetch_page`, só nos domínios de `officialDomains` em [`.agents/policy.yaml`](.agents/policy.yaml) (para `github.com`, só o repositório oficial da biblioteca).
3. **`ask_claude`**: pausa a tarefa e envia **só a pergunta** (objetiva, com o trecho mínimo). O Claude pesquisa e devolve **só a resposta necessária**; a tarefa continua de onde parou.

Regra de negócio nunca é pesquisada na web: dúvida de negócio vai para `ask_claude` (e, se preciso, para o Joel).

## 8. Definição de pronto

- [ ] Testes do cartão passam; nenhum teste alterado por quem implementou.
- [ ] `typecheck`, `lint`, fronteiras (dependency-cruiser), cobertura e (em `finance`) mutação dentro dos mínimos. O código já nasce seguindo o lint: as regras, com exemplo errado e certo, estão em [docs/memoria/lint.md](docs/memoria/lint.md) e vão no pedido da Alice.
- [ ] Sem `any`, `@ts-ignore`, `eslint-disable`, `.only/.skip`, `console.`, TODO sem ID.
- [ ] Nenhum arquivo fora de `allowedPaths`; nenhuma dependência nova.
- [ ] Nomes conforme glossário; textos pt-BR no arquivo de mensagens.
- [ ] IDs das regras citados no código (onde a regra é aplicada) e no PR.
- [ ] Docs atualizados se o comportamento mudou (feito pelo Claude).

## 9. Commits e PRs

- Commit: inglês, Conventional Commits (`feat(lending): generate installment schedule`), cita IDs no corpo.
- PR: título em inglês; corpo em pt-BR (o que, por quê, IDs, como testar, riscos).
- Commit com código da Alice: `Co-Authored-By: Alice (local model) <alice@localhost>`.
- Nunca comitar `.env`, dados reais, arquivos gerados ou `runs/`.

## 10. Nunca

- `float` para dinheiro; segredo no código; dado pessoal real em teste ou log.
- Ler/escrever tabela de outro módulo; chamar o interior de outro módulo.
- Editar ADR aceita (cria-se outra que substitui), teste protegido ou trava para "fazer passar".
- Inventar comportamento de biblioteca ou regra de negócio.
- Push direto na `main`.
