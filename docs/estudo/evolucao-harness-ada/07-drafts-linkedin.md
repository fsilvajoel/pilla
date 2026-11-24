# Roteiro de artigos no LinkedIn

## Série recomendada

### Parte 1 — Por que o primeiro harness gastava mais do que entregava

**Mensagem central**

O problema não era falta de agentes.
Era falta de um motor determinístico.

**Estrutura**

1. cenário;
2. como o Claude, o modelo local e o harness se dividiram;
3. primeira redução de custo;
4. falhas que apareceram;
5. conclusão parcial.

**Imagem**

- `graficos/01-toy-antes-depois.png`

### Parte 2 — Tokens crescem com o histórico

**Mensagem central**

A cada tentativa, o agente reprocessa o trabalho anterior.
Tarefa curta não é só o que cabe no cartão, mas quantos passos ela exige.

**Estrutura**

1. histórico como custo invisível;
2. tarefa longa com 35 chamadas;
3. impacto do contexto;
4. desligar raciocínio estendido;
5. controle por etapa.

**Imagem**

- `graficos/03-tarefas.png`
- `graficos/02-think.png`

### Parte 3 — TDD em tudo atrasava a UI

**Mensagem central**

Testar layout como se fosse regra cria atrito sem verificar a experiência.

**Estrutura**

1. diferença entre composição visual e domínio;
2. dispensar somente estilo;
3. manter teste de lógica;
4. E2E apenas em fluxo crítico;
5. mutação só em domainSources.

**Material**

- matriz em `04-modelo-sdd-cards.md`;
- seção sobre UI em `06-plano-evolucao-v2.md`.

### Parte 4 — Harness não é prompt

**Mensagem central**

Workflow, gate e retry precisam existir fora do contexto do modelo.

**Estrutura**

1. papéis e adaptadores da V1;
2. worktree e estado como fontes;
3. event log;
4. fallback;
5. evidência.

**Imagem**

- criar diagrama de Control Plane + Execution Plane;
- usar `03-arquitetura-v2.md`.

### Parte 5 — Especificação como produto do harness

**Mensagem central**

PRD, ADR, RFC, plano e cartão devem ser máquinas legíveis.

**Estrutura**

1. documentos aprovados;
2. critérios observáveis;
3. tabelas de domínio;
4. fontes;
5. schemas;
6. linters.

### Parte 6 — Posso deixar um modelo local orquestrar?

**Mensagem central**

Sim, com limites claros e fallback.

**Estrutura**

1. o que o orquestrador realmente faz;
2. VRAM e quantização;
3. contexto restrito;
4. engine especializada;
5. medição por feature.

**Imagem**

- `graficos/bancada-velocidade.png`
- `graficos/bancada-qualidade.png`

## Padrão para não publicar dado errado

Antes de publicar:

1. verificar `fontes/`;
2. marcar estimativas;
3. separar observação de hipótese;
4. não usar ID interno desnecessário;
5. usar valores completos apenas da mesma série;
6. revisar diagrama contra a implementação;
7. declarar quando algo ainda é pendente.
