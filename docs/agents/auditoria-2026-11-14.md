# Auditoria da arquitetura de agentes (2026-11-14)

| Campo | Valor |
|---|---|
| Status | Aprovada pelo Joel para execução da V1 |
| Autor | Claude (tech lead), a pedido do Joel |
| Execução | [execucao-v1.md](execucao-v1.md) |

Escopo: como os agentes (Joel, Claude, Alice) trabalham neste repositório e no `alice-harness`. Nenhuma alteração foi feita durante a auditoria.

## 1. Diagnóstico

```
Joel (decide, aprova docs/PRs)
  └─ Claude (planeja, escreve testes e travas, revisa, comita)
       ├─ Alice via alice-harness: tarefa por cartão → ferramentas com limites
       │     → verificação → relatório compacto → ask_claude se travar
       ├─ Alice via chamada direta: resumos e perguntas avulsas
       └─ Alice disparada pelo Windows (shell livre na VM de desenvolvimento) ← caminho paralelo
```

| Medida | Valor |
|---|---|
| Documentação total | 16,7 mil palavras (cerca de 25 mil tokens) |
| Maiores arquivos | PRD 2,9 mil · AGENTS.md 2,4 mil · cada RFC 1–1,4 mil palavras |
| Instrução que o Claude carrega em toda sessão | CLAUDE.md + AGENTS.md + docs/README, cerca de 5 mil tokens |
| Memória persistente | vazia (memória do Claude sem nada; `NOTAS-ALICE.md` nunca usado) |
| Tarefa de teste da Alice (função de 3 linhas) | 1ª rodada: 119 mil tokens; 2ª: 48 mil, dos quais 35 mil gerados por ela |

## 2. Pontos fortes (manter)
- **Spec Driven de verdade:** PRD → RFC → ADR, com status que bloqueiam a implementação, IDs estáveis (RN, CA, T) e glossário.
- **TDD com separação de papéis:** quem escreve o teste não implementa, e os testes ficam bloqueados para quem implementa.
- **Supervisor e executor funcionando:** o Claude só recebe o resultado aprovado; o ciclo de tentativa e erro roda na GPU local.
- **Regras impostas pela máquina:** limites de pasta, varredura do diff, lista de sites oficiais, limite de tentativas.
- **Escalada definida** (`ask_claude`) e skills de terceiros revisadas e fixadas numa versão.

## 3. Pontos fracos
1. Regras duplicadas em três ou quatro lugares (sites oficiais, arquivos protegidos e padrões proibidos no AGENTS.md, no `alice.py` e no futuro ESLint).
2. Contexto lido por arquivo inteiro: ler o PRD custa cerca de 4,5 mil tokens para usar uma regra de 3 linhas.
3. AGENTS.md atende leitores demais e mistura regras ativas com planejadas.
4. A Alice gera texto demais (35 mil tokens de saída para 3 linhas de código): custa tempo de GPU.
5. Ferramentas pobres para editar: `write_file` reescreve o arquivo inteiro, sem visão do próprio diff nem etapa de refatoração.
6. Uma tarefa por vez, sempre disparada pelo Claude.
7. O Claude ainda escreve todos os testes: será o maior custo de tokens daqui para a frente.
8. Sem memória de aprendizados, armadilhas e decisões pequenas.

## 4. Riscos
| Risco | Gravidade |
|---|---|
| Alice disparada pelo Windows com shell livre: lê `.env`, faz push e ignora as travas do harness | Alta |
| Claude e Alice editando os mesmos arquivos ao mesmo tempo (mesma cópia do repositório) | Média |
| Testes sempre escritos pela mesma IA → pontos cegos repetidos | Média (teste de mutação ajuda) |
| Regras duplicadas divergindo | Média |
| Windows desligado → fila parada → o Claude assume e gasta tokens | Média |
| Harness sem testes próprios: mudar o texto de instruções pode piorar a Alice sem ninguém perceber | Média |
| Memória num repositório público vazando IP ou dados pessoais | Baixa (exige regra) |

## 5. Gargalos
1. O Claude como ponto único (testes, recorte, dúvidas, revisão).
2. Leitura de documento inteiro, nos dois lados.
3. Uma tarefa por vez, iniciada manualmente.
4. Tempo de GPU gasto em texto gerado em excesso.

## 6. Comparação com boas práticas
| Conceito | Situação | O que falta |
|---|---|---|
| Hierarchical / Supervisor–Worker | ✅ | fila de tarefas; cópia separada do repositório por tarefa |
| Spec Driven Development | ✅ | índice de regras legível por máquina (ID → trecho) |
| AI-Augmented TDD | ✅ | Alice rascunhar testes (com revisão); mutação ativa |
| Context Engineering | 🟡 | leitura por regra; ficha por módulo; prefixo de prompt estável (cache do Ollama) |
| Memory-first | ❌ | memória com curadoria |
| Agentic SE (ciclo autônomo + avaliações) | 🟡 | tarefas-padrão para avaliar o harness; métricas de acerto |

## 7. Autonomia da Alice
Hoje ela entende, implementa, testa, corrige e repete. Faltam: refatoração obrigatória com nova checagem; lint no ciclo; ver o próprio diff e editar trechos (`view_diff`, `edit_file`); fila com dependências; dúvida que pausa só a tarefa bloqueada. Com isso o Claude é interrompido duas vezes por tarefa (aprovar testes, revisar resultado).

## 8. Agentes especializados
Recomendação: **não criar agentes novos; usar modos da Alice** (campo `kind` do cartão, com outro texto de instruções e outros caminhos liberados).

| Papel | Vale? | Como |
|---|---|---|
| Architect | ❌ | Claude + Joel, via ADR |
| Planner | 🟡 modo | Alice rascunha cartões a partir das RFCs; Claude confere |
| Developer | ✅ existe | `implement` |
| Tester (autor de testes) | ✅ maior ganho | `test-author` em sessão nova; Claude revisa; outra execução implementa |
| Reviewer | ✅ pré-filtro | `pre-review` em sessão nova antes do Claude |
| Refactorer | ❌ | etapa do ciclo `implement` |
| Documentation | 🟡 modo | Alice rascunha fichas e corpo de PR; Claude faz curadoria |
| Security | ❌ | Claude + skills em momentos fixos (autenticação, portal) |
| Performance | ❌ no MVP | — |

## 9. Memória
Memória versionada, com curadoria (a Alice propõe, o Claude aprova): `docs/memoria/licoes.md`, `docs/memoria/decisoes-menores.md`, `docs/memoria/modulos/<module>.md` (≤ 300 palavras). O `finish` da Alice devolve até 3 aprendizados; resposta a `ask_claude` reutilizável vira lição. Nada de dado pessoal nem IP. Decisões grandes continuam nas ADRs.

## 10. Economia de tokens
| Medida | Efeito estimado |
|---|---|
| Índice de regras + `read_rule(ID)`; cartão lista IDs | leitura por tarefa de 3–6 mil para < 1 mil tokens |
| Alice como autora de testes | −50 a 70% de tokens do Claude por tarefa |
| Fichas de módulo | evita redescobrir código |
| Fila em lote | menos rodadas de orquestração |
| AGENTS.md enxuto + detalhes sob demanda | −2 a 3 mil tokens por sessão |
| Ajuste do raciocínio da Alice | menos tempo de GPU |
| Métricas por tarefa | calibrar com dado real |

## 11. Sugestões para o AGENTS.md
1. Núcleo enxuto + `docs/agents/` com os detalhes.
2. Fonte única das regras: `.agents/policy.yaml`, lido pelo harness.
3. Tipos de tarefa (`implement`, `test-author`, `pre-review`, `docs`, `cards`) e cartão com `rules: [IDs]`.
4. Orçamento de contexto (Claude usa o índice; tarefa da Alice ≤ ~20 mil tokens de leitura).
5. Caminho único da Alice para código: o harness, inclusive vindo do Windows.
6. Seção de memória.
7. Indicação de ativo × planejado em cada trava.

## 12. Fluxo recomendado
```
PRD/RFC aprovados
 ↓
Plano da entrega (Claude) + rascunho de cartões (Alice) → ok do Joel por ENTREGA
 ↓  por tarefa:
Alice [test-author] → Claude revisa (em lote) → commit dos testes (bloqueados)
 ↓
Alice [implement]: implementa → testa → corrige → refatora → lint → verifica
 ↓  (dúvida: docs oficiais → ask_claude → resposta vira lição)
Alice [pre-review] em sessão nova → Claude revisa conforme o risco
 ↓
Alice propõe lições/ficha do módulo → Claude faz curadoria → commit
 ↓  fim da entrega:
PR + the-judge + auditoria de acoplamento → merge pelo Joel
```

## 13. Roadmap
**V1 (≈ 1 dia):** fechar o atalho do Windows (P0); `policy.yaml` (P1); índice de regras + `read_rule` + cartão por IDs (P0); `edit_file`, `view_diff`, refatoração e lint (P1); métricas + ajuste do raciocínio (P1); memória v1 (P0); dividir o AGENTS.md (P2).

**V2 (durante E1–E3):** modo `test-author` + mutação obrigatória (P0); fila com dependências + cópia isolada por tarefa (P1); `pre-review` (P1); tarefas-padrão para avaliar o harness (P1); `pnpm verify` único (P1).

**V3:** orquestração por eventos (CI/PR → tarefa da Alice); harness como servidor MCP e versão em TS; escolha automática Alice × Claude por métricas; busca semântica local; dois modelos locais (rápido e maior).

## 14. Prioridade por retorno
1. Fechar o atalho do Windows. 2. Índice de regras + `read_rule`. 3. Memória v1. 4. `test-author`. 5. `policy.yaml`. 6. `edit_file`/`view_diff`/refatoração/lint. 7. Métricas + raciocínio. 8. Fila + cópia isolada. 9. `pre-review`. 10. Tarefas-padrão do harness. 11. Dividir o AGENTS.md.
