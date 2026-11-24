# Plano de Evolução — Ada Harness 2.0

## 1. Objetivo

Construir uma fábrica de software controlada por IA que:

1. transforme PRD, ADR, RFC e especificações aprovadas em features e cartões;
2. execute features de forma determinística e, quando possível, autônoma;
3. permita trocar Claude, Codex, Gemini, Sonnet, modelos locais ou outras ferramentas por configuração;
4. reserve o uso do orquestrador apenas para decisões humanas, decisões de produto e revisão que exigem raciocínio amplo;
5. reduza custo e tempo de tokens por meio de contextos pequenos, evidência objetiva e fallbacks;
6. permita acompanhar visualmente o pipeline em tempo real;
7. mantenha qualidade sem aplicar TDD, cobertura, mutação e E2E iguais a todo tipo de trabalho.

Este documento é instrução operacional para uma IA executar a evolução. Não é um plano narrativo.
Ao concluir uma etapa, a IA deve atualizar o progresso, rodar a menor validação que prova a mudança e fornecer evidência curta.

## 2. Premissas fixas

- Repositório-alvo: `/home/debian/code/harness-ada`.
- Não reconstruir o harness do zero nesta primeira entrega.
- Preservar os contratos úteis do Harness 1:
  - papéis;
  - adaptadores;
  - skills;
  - gates;
  - cartões;
  - `estado.json`;
  - worktrees isoladas;
  - `pnpm verify`;
  - commits pequenos.
- Não alterar regras de produto ou criar comportamento novo sem fonte aprovada no SDD.
- Não considerar texto de agente como prova de sucesso.
- Não concluir uma etapa com estado manualmente forjado.
- Toda transição de estado deve ser consequência de um comando, gate ou evento registrado.
- Toda alteração deve preservar compatibilidade com estados existentes do Harness 1.
- `estado.json` não é a única fonte de verdade em 2.0; ele passa a ser uma projeção derivada de um event log.
- O orquestrador não escreve arquivos diretamente fora do scope autorizado pelo motor.
- Mudanças fora do escopo de uma onda exigem uma nova decisão ou uma justificativa técnica curta no plano.

## 3. Estado atual que deve ser preservado

Os componentes atuais relevantes são:

- workflow declarativo em `workflow/feature.md`;
- papéis em `agent/`;
- adaptadores em `adapter/`;
- gates em `gate/`;
- scripts determinísticos em `script/`;
- estado derivado em `script/status.py`;
- loop restrito em `script/run_card.py`;
- configuração por papel e trabalhador em `harness.project.yaml`;
- testes do próprio harness em `tests/`.

Baseline antes da evolução:

```bash
cd /home/debian/code/harness-ada
.venv/bin/pytest -q
```

Deve terminar com sucesso antes e depois de cada onda.

## 4. Problema da versão atual

Corrigir estas causas-raiz:

1. o workflow é texto, não uma máquina de estados executável;
2. o orquestrador toma decisões de retry e fallback;
3. o orquestrador reconcilia texto de agentes;
4. o estado pode divergir do histórico git;
5. a área de trabalho não é preparada por um controle central;
6. o refinamento pode gastar tokens sem mudanças necessárias;
7. todos os tipos de cartão podem acabar usando o mesmo peso de testes;
8. workers podem falhar sem outro executor configurado;
9. não existe painel único do pipeline;
10. não existe visão consolidada de custo por feature, etapa e engine.

Não corrigir esses problemas adicionando prompts maiores ao orquestrador.
Corrigir com schemas, máquinas de estado, scripts e evidências estruturadas.

## 5. Varredura de etapas dispensáveis

### 5.1 Matriz oficial de etapas por tipo de trabalho

| Tipo de trabalho | Plan | Refinamento | Testes | Expect-red | Revisão dos testes | Implementação | Mutação | E2E | Revisão final | Fechamento |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| regra ou cálculo puro | obrigatório | fast-check | obrigatório | obrigatório | obrigatório | obrigatório | completo | conforme PRD | obrigatório | obrigatório |
| validação ou formulário | obrigatório | fast-check | obrigatório | obrigatório | obrigatório | obrigatório | completo | se crítico | obrigatório | obrigatório |
| API ou contrato | obrigatório | fast-check | obrigatório | obrigatório | obrigatório | obrigatório | conforme domínio | se fluxo crítico | obrigatório | obrigatório |
| componente visual sem regra | obrigatório | fast-check | não obrigatório | dispensado | dispensada | obrigatório | dispensada | se fluxo crítico | obrigatório | obrigatório |
| layout ou CSS puro | fora de feature | dispensado | dispensado | dispensado | dispensada | obrigatório | dispensada | revisão visual | revisão visual | obrigatório |
| componente de biblioteca sem comportamento novo | fora de feature | dispensado | dispensado | dispensado | dispensada | obrigatório | dispensada | se fluxo crítico | obrigatório | obrigatório |
| documentação aprovada | dispensável | opcional | dispensado | dispensado | dispensada | obrigatório | dispensada | dispensado | revisão documental | obrigatório |
| configuração ou tooling | obrigatório | fast-check | conforme risco | conforme teste | conforme teste | obrigatório | dispensada | dispensado | obrigatório | obrigatório |
| correção de defeito | obrigatório | obrigatório | obrigatório | obrigatório | obrigatório | obrigatório | conforme domínio | se regressão crítica | obrigatório | obrigatório |

Uma feature não pode existir sem pelo menos um arquivo de produção classificado como `tdd`, salvo no workflow de layout/tarefa isolada já previsto.

### 5.2 Decisões que tornam UI menos pesada

A aplicação da versão atual já contém a classificação `tdd`, `dispensa-estilo` e `dispensa-biblioteca`.
A versão 2 deve tornar essa classificação uma entrada obrigatória da máquina de estados, não uma interpretação do agente.

Manter:

- `expect-red`, revisão dos testes e mutação para regra, cálculo, validação, contrato e adaptador;
- testes de comportamento para lógica extraída da tela;
- cobertura para arquivos de `sources` classificados como `tdd`;
- E2E para fluxo crítico descrito no PRD;
- revisão visual no navegador para layout e composição;
- a política de que componente de biblioteca alterado volta a `tdd`.

Dispensar ou reduzir:

- TDD para arquivo que contém somente layout, estilo e composição visual;
- cobertura 100% de arquivos somente visuais;
- mutação de componentes sem domínio;
- revisão longa de testes em cartão puramente visual;
- propriedade aleatória em componente visual que não parseia nem calcula;
- teste unitário de nomes de CSS, classes, estrutura interna ou ordem de chamadas;
- segunda opinião em toda execução;
- refinamento completo quando plano e cartões já passam em `plan-lint` e `card-lint`;
- E2E em toda feature; somente fluxo crítico do PRD;
- tradução e sincronização individual de toda issue;
- commit humano entre cada etapa de uma mesma feature.

### 5.3 Refinamento em duas velocidades

Criar dois modos:

```yaml
refinement:
  default: fast
  modes:
    fast:
      max_calls: 1
      condition: plan_lint_pass && card_lint_pass
    complete:
      max_calls: 2
      condition: ambiguity || missing_decision || pm_queue_required
```

Modo rápido:

- só reconcilia plano, cartões e fila;
- não roda segunda opinião;
- não reescreve conteúdo que já passou nos linters;
- chama o refiner somente se `plan-lint` encontrar lacuna resolvível localmente.

Modo completo:

- mantém a fila de PM;
- permite duas chamadas;
- após a segunda rodada, bloqueia para decisão humana.

### 5.4 Segunda opinião condicional

Não usar segunda opinião por padrão em todas as features.

Usar somente quando ocorrer ao menos uma destas condições:

- plano ou cartão em área crítica;
- feature marcada como crítica no PRD;
- mudança em segurança;
- mudança em contrato público;
- a primeira revisão encontrou achado estrutural;
- o score do reviewer estiver baixo;
- mutação ou cobertura estiverem repetidamente falhando;
- o custo adicional estiver dentro do orçamento da opinião.

Registrar no estado o motivo da segunda opinião.

### 5.5 Fallback por etapa

Cada etapa pode declarar fallback:

```yaml
fallback:
  on:
    - rejected
    - worker_error
    - gate_fail
  executors:
    - sonnet
    - local
  max_attempts: 3
```

Fallback não altera:

- gates;
- scopes;
- esquemas;
- artefatos obrigatórios;
- testShas;
- worktree;
- política de commits.

## 6. Arquitetura da versão 2

```text
entrada SDD
  -> parser e validador
  -> plano
  -> cartões
  -> scheduler
  -> engine pool
  -> worktree por tentativa
  -> evidências
  -> gates
  -> event log
  -> estado derivado
  -> dashboard
```

### 6.1 Control Plane

Implementar em Python dentro de `script/`.

Responsabilidades:

- carregar configuração;
- iniciar features;
- escolher o próximo stage;
- preparar worktree;
- executar engines;
- interpretar códigos de saída;
- aplicar retry e fallback;
- executar gates;
- validar schemas;
- gravar eventos;
- derivar `estado.json`;
- registrar uso de tokens;
- aplicar rollback;
- fechar commits.

O Control Plane não usa modelo de linguagem para decidir transições simples.

### 6.2 Execution Plane

Cada engine só recebe:

- papel;
- etapa;
- artefatos necessários;
- scope autorizado;
- skills necessárias;
- formato obrigatório de saída;
- limite de tentativas;
- limite de uso.

Não permitir que uma engine:

- assine testes;
- altere estado;
- execute commits;
- altere gates;
- escolha seu próprio fallback;
- escreva fora do scope;
- pule validação.

### 6.3 Artifact Plane

Todos os artefatos precisam estar em diretórios estáveis:

```text
docs/spec/<feature>/
  prd.md
  adr.md
  rfc.md
  plano.md
  testes.md
  revisao.md
  estado.json
  eventos.jsonl
evidencias/<run>/<feature>/<stage>/<attempt>/
```

`eventos.jsonl` é append-only.
`estado.json` é regenerado a partir dos eventos.

## 7. Contratos estruturados

### 7.1 Resultado de engine

Toda engine deve devolver JSON válido:

```json
{
  "status": "completed",
  "changed_files": ["src/exemplo.ts"],
  "commands_run": [
    {"command": "pnpm test", "exit_code": 0}
  ],
  "warnings": [],
  "next_action": "none"
}
```

Campos obrigatórios:

- `status`;
- `changed_files`;
- `commands_run`;
- `warnings`;
- `next_action`.

Resultados fora desse schema são `rejected`, não `gate-fail`.

### 7.2 Evidência de gate

Todo gate grava um objeto:

```json
{
  "gate": "coverage",
  "status": "PASS",
  "exit_code": 0,
  "input_sha": "sha",
  "output_sha": "sha",
  "evidence": "evidencias/run/feature/implement/2/coverage.json",
  "started_at": "2026-11-20T00:00:00Z",
  "finished_at": "2026-11-20T00:00:10Z"
}
```

O gate não deve depender de leitura humana da saída.

### 7.3 Evento de pipeline

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
  "gate_results": ["tests-reviewed", "coverage"],
  "usage": {
    "prompt_tokens": 12840,
    "completion_tokens": 3102
  }
}
```

## 8. Máquina de estados

Transições mínimas:

```text
QUEUED
 -> PLAN_RUNNING
 -> PLAN_READY | NEEDS_INPUT | FAILED

PLAN_READY
 -> REFINEMENT_RUNNING | CARD_READY

CARD_READY
 -> TEST_RUNNING
 -> IMPLEMENT_READY

TEST_RUNNING
 -> TEST_READY | FAILED

TEST_READY
 -> TEST_REVIEW_RUNNING
 -> TEST_REVIEW_APPROVED | FAILED

TEST_REVIEW_APPROVED
 -> IMPLEMENT_RUNNING

IMPLEMENT_RUNNING
 -> IMPLEMENT_READY | GATE_FAILED | FAILED

IMPLEMENT_READY
 -> MUTATION_E2E_RUNNING | FINAL_REVIEW_RUNNING

FINAL_REVIEW_RUNNING
 -> FINAL_REVIEW_APPROVED | FAILED

FINAL_REVIEW_APPROVED
 -> CLOSING
 -> DONE | FAILED
```

`FAILED` não significa que a feature está concluída.
`FAILED` significa que um executor ou gate não aprovou; o motor decide retry, fallback ou NEEDS_INPUT.

`NEEDS_INPUT` é reservado para decisão humana e é a única transição que exige resposta externa.

## 9. Worktrees e branch

Cada stage recebe uma worktree isolada:

```text
.harness/runs/<run>/<feature>/<stage>/<attempt>
```

Antes da execução, o Control Plane deve provar:

- base correta;
- índice vazio;
- branch `feat/<feature-id>` ou nome definido no projeto;
- sem stash da feature;
- sem alteração fora da worktree;
- test hashes registrados;
- scope permitido conhecido.

Após execução:

- comparar diff com `allowedPaths`;
- proteger `protectedTests`;
- registrar base e head SHA;
- executar formatação e checks;
- executar gates;
- reverter mudanças no caso de falha técnica;
- manter ou descartar alterações conforme política da etapa.

Nunca commitar uma feature em uma branch documental ou misturar commits de feature.

## 10. Configuração por engine

Extender `harness.project.yaml` com uma configuração explícita de engines e stages:

```yaml
engines:
  claude:
    adapter: claude-code
  sonnet:
    adapter: cli-agent
  bia:
    adapter: api-chat
  baidu:
    adapter: api-tools
  local:
    adapter: cli-agent

stage_engines:
  planner:
    primary: claude
    fallback: [sonnet]
  test-writer:
    primary: bia
    fallback: [sonnet]
  reviewer:
    primary: claude
  implementer:
    primary: baidu
    fallback: [sonnet, claude]
```

O adaptador continua agnóstico a modelo.
O projeto decide engine por stage, tipo de cartão, custo e área de alteração.

## 11. Linters obrigatórios

### 11.1 `plan-lint`

Falha quando:

- critério não é observável;
- A<n> não tem camadas declaradas;
- entrada externa não tem domínio;
- erro esperado não está definido;
- contrato não tem assinatura ou payload;
- arquivo de produção não tem classificação TDD;
- não existe ao menos um arquivo `tdd`;
- fonte aprovada não existe;
- path no plano não existe ou não foi declarado como novo;
- dependência não tem cartão;
- cenário não aponta para critério.

### 11.2 `card-lint`

Falha quando:

- cartão não tem DoR;
- cartão não tem DoD;
- allowedPaths está vazio;
- protectedTests não protege testes revisados;
- skill exigida não existe;
- checks citam comando não configurado;
- tipo visual não declara skills de UI;
- lógica visual não foi extraída para arquivo `tdd`;
- cartão visual exige mutação ou cobertura sem domínio.

### 11.3 `artifact-lint`

Falha quando:

- estado não corresponde ao event log;
- gate não tem evidência;
- testSha não corresponde ao arquivo;
- implementação terminou sem gate obrigatório;
- commit passou sem stage done;
- artefato obrigatório está ausente.

## 12. Gates condicionais

Implementar regras explícitas em estado:

```yaml
testing:
  tdd: [unit, prop, mut]
  visual: [review_visual]
  e2e: [e2e]
  mutation:
    mode: full | sampled | off
  coverage:
    mode: full | sources-only | off
```

### Condições

- `expect-red`: obrigatório apenas se houver ao menos um arquivo `tdd`.
- `coverage`: obrigatório apenas para `sources`; dispensas permanecem em `exemptSources`.
- `mutation`: obrigatório apenas para `domainSources`; mutação de domínio crítico pode usar modo full; mutação de regressão pode usar sampled.
- `e2e`: obrigatório apenas se houver critério `e2e`; não criar critério artificial para UI.
- `test-review`: obrigatório para testes de regra e contrato; pode ser abreviado para componente visual que só alterou comportamento já testado.
- `review-final`: obrigatório para toda entrega com código.
- `pnpm verify`: obrigatório antes de DONE.
- sincronização GitHub: opcional por lote; exige aprovação humana apenas no `--apply`.

## 13. Dashboard

Construir uma aplicação local de pipeline com:

- fila por stage;
- feature e cartão;
- stage atual;
- engine ativa;
- tentativa atual;
- retry e fallback;
- percentagem derivada do estado;
- gates PASS/FAIL;
- bloqueios;
- worktree;
- branch;
- diff;
- uso de tokens;
- custo acumulado;
- duração por stage;
- eventos recentes;
- pendências de PM;
- link para evidências;
- rerun de stage;
- cancelamento seguro.

Atualização por SSE ou WebSocket.
Não permitir editar estado diretamente pela interface.

O dashboard é uma projeção dos artefatos e eventos.

## 14. Métricas

Coletar por feature e por engine:

- tokens do orchestrator;
- tokens da engine;
- custo por stage;
- custo por tentativa;
- duração;
- quantidade de retries;
- quantidade de fallbacks;
- taxa de gate-fail;
- taxa de trabalho refeito;
- taxa de revisão reprovada;
- mutantes gerados e sobreviventes;
- tempo até NEEDS_INPUT;
- tempo até DONE;
- percentual de stages executados por engine determinística.

O objetivo não é somente reduzir custo.
É comparar custo adicional com retrabalho evitado.

## 15. SDD completo

Adicionar ao pipeline a cadeia:

```text
PRD aprovado
 -> ADR aprovado
 -> RFC aprovado
 -> plano técnico aprovado
 -> features
 -> cartões
 -> testes
 -> implementação
 -> release
```

Nenhum documento avança sem veredito estruturado:

```json
{
  "document": "ADR",
  "status": "approved",
  "reviewer": "human",
  "hash": "sha",
  "decisions": [],
  "open_questions": []
}
```

## 16. Ondas de implementação

### Onda 0 — Baseline e invariantes

Executar:

1. registrar baseline dos 210 testes;
2. identificar contratos que podem mudar;
3. criar lista de compatibilidade;
4. gerar fixtures de estados antigos;
5. não editar regras de workflow nesta onda.

Critério de conclusão:

- baseline verde;
- inventário completo;
- nenhuma alteração funcional.

### Onda 1 — Pipeline determinístico

Implementar:

- event log;
- máquina de estados;
- execução sequencial;
- worktree por tentativa;
- evidência de gate;
- retry por tipo de erro;
- fallback por stage;
- regeneração de estado.

Arquivos esperados:

```text
script/pipeline.py
script/events.py
script/worktree.py
script/evidence.py
script/stage_runner.py
tests/test_pipeline.py
tests/test_events.py
tests/test_worktree.py
tests/test_stage_runner.py
```

Não modificar o dashboard nesta onda.

Critério de conclusão:

- feature teste atravessa todas as stages sem agent no Control Plane;
- retry funciona;
- fallback funciona;
- rollback funciona;
- estado pode ser apagado e reconstruído;
- estados antigos continuam válidos.

### Onda 2 — Schemas e linters

Implementar:

- JSON schemas;
- `plan-lint`;
- `card-lint`;
- `artifact-lint`;
- validação de engine result;
- validação de gate evidence;
- validação de testShas;
- validação de allowedPaths.

Critério de conclusão:

- defeitos F03–F05 não passam no commit do plano;
- cartão incompleto não entra no scheduler;
- esquema inválido impede a stage;
- `.md` não é usado como fonte de transição.

### Onda 3 — Política condicional de testes

Implementar:

- classificação obrigatória por arquivo;
- fast refinement;
- visual workflow fora de feature;
- mutação condicional;
- cobertura condicional;
- E2E condicional;
- segunda opinião condicional;
- mutação curta antes da revisão do teste onde aplicável.

Critério de conclusão:

- tela puramente visual não exige expect-red;
- lógica extraída de tela entra em feature;
- mutação não roda sem domainSources;
- E2E não roda sem critério e2e;
- etapa visual gera evidência no navegador.

### Onda 4 — Dashboard

Implementar:

- API local;
- feed de eventos;
- fila;
- worktrees;
- logs;
- uso e custo;
- rerun seguro.

Não permitir edição manual de estado pela tela.

Critério de conclusão:

- acompanhar uma feature em tempo real;
- mostrar bloqueios e etapas;
- mostrar engine e fallback;
- mostrar evidências e diff;
- recuperar status após reiniciar o processo.

### Onda 5 — SDD completo

Implementar:

- parser de PRD;
- validação de ADR;
- validação de RFC;
- geração de features;
- geração de cartões;
- sincronização GitHub em lote;
- aprovação humana explícita.

Critério de conclusão:

- especificação aprovada gera feature;
- feature gera cartões;
- cartões passam nos linters;
- pipeline começa sem trabalho manual intermediário.

### Onda 6 — Otimização

Medir:

- custo por engine;
- retrabalho;
- fallback;
- gates;
- tempo.

Só alterar engine default após:

- evidência reproduzível;
- taxa de aprovação suficiente;
- custo por feature medido;
- baseline anterior registrada.

## 17. Ordem obrigatória de implementação

1. não alterar workflow antes da máquina de estados;
2. não alterar dashboard antes do event log;
3. não adicionar novo engine antes do fallback;
4. não adicionar novo gate antes da evidência estruturada;
5. não reduzir teste visual antes da revisão visual automatizável;
6. não remover cobertura antes de confirmar a classificação dos arquivos;
7. não mudar teste para passar; corrigir produto ou teste pela origem da regra;
8. não commitar até todos os gates aplicáveis passarem;
9. não concluir sem evidência curta.

## 18. Testes da evolução

Cada onda deve adicionar testes focados em:

- transições válidas e inválidas;
- retry;
- fallback;
- custo acumulado;
- estado perdido e regenerado;
- worktree suja;
- branch errada;
- stash da feature;
- arquivo fora do scope;
- teste protegido alterado;
- testSha alterado;
- gate sem evidência;
- engine result inválido;
- plano sem critério;
- plano visual sem arquivo tdd;
- feature visual com lógica não extraída;
- mutação sem domainSources;
- E2E sem critério e2e;
- compatibilidade com estado da versão 1;
- regeneração idempotente de estado;
- commit com estado inconsistente.

Não escrever testes que apenas comparem constantes ou implementeções triviais.

## 19. Comandos de validação

Executar após cada onda:

```bash
cd /home/debian/code/harness-ada
.venv/bin/pytest -q
.venv/bin/python -m compileall -q script
```

Executar quando gates forem alterados:

```bash
python3 script/check_status_consistency.py /caminho/do/projeto
python3 script/status.py /caminho/do/projeto --print
```

Executar antes de concluir uma onda:

```bash
.venv/bin/pytest -q
git --no-pager diff --stat
git --no-pager diff --check
git --no-pager status --short
```

Não usar `git reset --hard`, `git checkout --` ou limpeza ampla sem aprovação humana.

## 20. Critério final da versão 2

A versão 2 está concluída quando:

- uma especificação aprovada entra no sistema;
- features e cartões são gerados;
- o pipeline mostra stage, engine, tentativa e gate;
- o trabalho visual não exige TDD de CSS e layout;
- lógica visual crítica exige TDD e extração;
- workers podem cair sem interromper o pipeline;
- fallback é automático e registrado;
- gates obrigatórios possuem evidência;
- worktree nunca herda estado sujo;
- `estado.json` pode ser apagado e reconstruído;
- commits passam no gate de consistência;
- uma feature pode chegar a DONE sem reconferência manual de stdout;
- o humano decide somente onde o plano exige;
- o custo por feature é visível;
- o orquestrador usa menos contexto do que executava na versão 1.

## 21. Entregas do plano

Ao iniciar o trabalho, a IA deve entregar em sequência:

1. resultado da baseline;
2. lista dos arquivos que serão modificados;
3. desenho da onda ativa;
4. implementação;
5. testes adicionados;
6. validação executada;
7. resumo de custo e retrabalho esperado;
8. pendências humanas;
9. próximo passo recomendado.
