# Arquitetura proposta da V2

## Visão geral

```text
documentos SDD aprovados
  -> gerador de plano
  -> gerador de features
  -> gerador de cartões
  -> scheduler
  -> pool de engines
  -> worktree por tentativa
  -> gates
  -> event log
  -> estado derivado
  -> dashboard
```

## Três planos

### Control Plane

Escrito em Python.

Responsável por:

- máquina de estados;
- scheduler;
- worktrees;
- retry;
- fallback;
- execução de gates;
- schemas;
- commits;
- estado;
- métricas;
- rollback.

Não usa modelo de linguagem para escolher a próxima transição quando existe regra determinística.

### Execution Plane

Contém os motores substituíveis:

- Claude;
- Sonnet;
- Codex;
- Gemini;
- Qwen local;
- api-chat;
- api-tools;
- cli-agent.

Cada engine recebe contexto pequeno e um schema de saída.

A engine não pode:

- assinar testes;
- alterar estado;
- commitar;
- alterar gates;
- usar fallback sem configuração;
- escrever fora do scope.

### Artifact Plane

Contém a verdade documental e operacional:

- PRD;
- ADR;
- RFC;
- plano;
- cartões;
- testes;
- diffs;
- gate evidence;
- event log;
- estado;
- revisão.

## Máquina de estados

Estados mínimos:

```text
QUEUED
  -> PLAN_RUNNING
  -> PLAN_READY

PLAN_READY
  -> REFINEMENT_RUNNING
  -> CARD_READY

CARD_READY
  -> TEST_RUNNING
  -> IMPLEMENT_RUNNING

TEST_RUNNING
  -> TEST_READY

TEST_READY
  -> TEST_REVIEW_RUNNING
  -> TEST_REVIEW_APPROVED

TEST_REVIEW_APPROVED
  -> IMPLEMENT_RUNNING

IMPLEMENT_RUNNING
  -> IMPLEMENT_READY
  -> GATE_FAILED

IMPLEMENT_READY
  -> MUTATION_E2E_RUNNING
  -> FINAL_REVIEW_RUNNING

FINAL_REVIEW_RUNNING
  -> FINAL_REVIEW_APPROVED

FINAL_REVIEW_APPROVED
  -> CLOSING
  -> DONE
```

Estados adicionais:

- `FAILED`: falha técnica ou funcional, com motivo;
- `NEEDS_INPUT`: decisão humana explícita;
- `QUOTA`: cota indisponível;
- `RETRYING`: nova tentativa;
- `FALLBACK`: executor substituto;
- `CANCELLED`: cancelamento seguro.

## Event log

Exemplo:

```json
{
  "event": "stage.result",
  "run_id": "run-001",
  "feature_id": "E9-F02",
  "stage": "implement",
  "attempt": 2,
  "executor": "sonnet",
  "result": "PASS",
  "base_sha": "d940b89",
  "head_sha": "a6f14ca",
  "gate_results": ["tests-reviewed", "coverage"]
}
```

`estado.json` é reconstruído a partir destes eventos.
Isso permite diagnosticar e corrigir uma divergência sem confiar apenas no último estado.

## Worktree por tentativa

Estrutura:

```text
.harness/runs/<run>/<feature>/<stage>/<attempt>
```

Antes da execução:

- branch correta;
- índice vazio;
- sem stash da feature;
- base SHA registrada;
- scope conhecido;
- testes protegidos identificados.

Depois da execução:

- diff dentro do scope;
- gates executados;
- evidências registradas;
- rollback em falha técnica;
- commit só em conclusão válida.

## Fallback

Exemplo de configuração:

```yaml
stage_engines:
  test-writer:
    primary: bia
    fallback: [sonnet]
  implementer:
    primary: baidu
    fallback: [sonnet, claude]
```

O fallback é acionado por resultado técnico:

- output fora do schema;
- worker timeout;
- quota;
- 429;
- gate-fail;
- no-key;
- alteração fora do scope;
- worktree inconsistente.

## Fila visual

O dashboard mostra:

- feature;
- etapa;
- engine;
- attempt;
- retry/fallback;
- gates;
- branch;
- worktree;
- diff;
- evidência;
- custo;
- duração;
- pendência humana.
