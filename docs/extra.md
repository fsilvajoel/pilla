
# PLATFORM_MODEL

Este documento complementa o **harness Ada**.

Enquanto o plano principal define **onde cada componente vive**, este documento define **como os componentes se relacionam** e quais princípios arquiteturais devem ser preservados durante a evolução do harness.

---

# Objetivo

O harness Ada não é apenas um conjunto de prompts.

Ele é uma plataforma para execução de agentes de IA.

O objetivo da arquitetura é permitir que novos agentes, Skills, Tools e Workflows sejam adicionados continuamente sem aumentar significativamente a complexidade do sistema.

A evolução deve privilegiar reutilização, modularidade e baixo acoplamento.

---

# Modelo Conceitual

```
Usuário

↓
(Coordenador)

↓

Workflow

↓

Agente

↓

Capability

↓

Skill

↓

Tool

↓

Gate

↓

Resultado
```

Cada camada possui uma responsabilidade única.

Nenhuma camada deve assumir responsabilidades pertencentes a outra.

---

# Responsabilidades

## Coordenador

Responsável por:

- entendimento do objetivo
- planejamento
- decomposição do trabalho
- coordenação dos agentes
- revisão arquitetural
- acompanhamento da execução

Claude não deve conter conhecimento técnico específico que possa ser transformado em Skill.

---

## Agentes

Agentes representam papéis.

Cada agente possui:

- objetivo
- responsabilidades
- critérios de sucesso
- forma de raciocínio

Agentes não representam tecnologias.

Exemplos corretos:

- Developer
- Planner
- Reviewer
- Architect
- Platform Engineer

Exemplos incorretos:

- NextJS Agent
- Docker Agent
- GitHub Agent
- Brave Agent

Conhecimento técnico deve ser movido para Skills.

---

# Capability

Capability representa uma capacidade reutilizável da plataforma.

Uma Capability normalmente combina:

- uma ou mais Skills
- uma ou mais Tools
- Policies
- Gates

Ela representa um comportamento completo da plataforma.

Exemplos:

Web Research

Code Modification

Documentation Analysis

Architecture Review

Testing

Planning

Uma Skill pode pertencer a várias Capabilities.

Uma Capability pode utilizar várias Skills.

---

# Skills

Skills representam conhecimento.

Uma Skill ensina:

- quando utilizar
- quando não utilizar
- boas práticas
- exemplos
- limitações

A Skill nunca executa ações diretamente.

Ela orienta o agente.

---

# Tools

Tools executam ações.

Uma Tool:

- consulta APIs
- lê arquivos
- altera arquivos
- executa comandos
- comunica-se com serviços externos

Tools não possuem inteligência.

Recebem entrada.

Produzem saída.

---

# Gates

Gates representam critérios objetivos.

Nunca contêm lógica de negócio.

Um Gate apenas responde:

PASS

ou

FAIL

Toda lógica necessária para validar o Gate pertence à Tool correspondente.

---

# Workflows

Workflow representa um processo completo.

Um Workflow define:

- sequência
- agentes
- Skills
- Capabilities
- Tools
- Gates
- condição de encerramento

O Workflow nunca implementa conhecimento técnico.

---

# Policies

Policies representam regras globais da plataforma.

Não pertencem a agentes.

Não pertencem a Skills.

São reutilizadas por toda a arquitetura.

Exemplos:

- política de edição
- política de pesquisa
- política de delegação
- política de qualidade
- política de segurança

Sempre que uma mesma regra aparecer em múltiplas Skills, ela deve ser movida para uma Policy.

---

# Auto Validação

Todo agente executor deve validar seu próprio trabalho antes de entregá-lo.

Fluxo esperado:

Executar

↓

Validar

↓

Corrigir

↓

Validar novamente

↓

Entregar

Sempre que possível, o próprio agente deve corrigir erros simples.

Exemplos:

- lint
- typecheck
- build
- testes
- imports
- formatação

Esses problemas não devem ser delegados imediatamente.

---

# Delegação

Delegar possui custo.

Antes de acionar outro agente deve existir uma tentativa local de resolução.

Fluxo esperado:

Executar

↓

Falhou

↓

Auto correção

↓

Novo Gate

↓

Falhou novamente

↓

Nova tentativa

↓

Persistiu

↓

Delegar

---

# Papel do especialista

O especialista representa quem domina a plataforma.

Sua responsabilidade não é corrigir código comum.

Sua responsabilidade é corrigir problemas estruturais.

Exemplos:

- harness
- arquitetura
- workflows
- Skills
- Tools
- integração
- observabilidade
- regressões sistêmicas

Erros simples devem ser resolvidos pelo próprio agente executor.

O sucesso da plataforma será medido pela redução gradual da necessidade de intervenção do especialista.

---

# Observabilidade

Toda execução deve gerar histórico.

Idealmente registrar:

- agente utilizado
- workflow
- Skills carregadas
- Tools utilizadas
- Gates executados
- tempo
- consumo de tokens
- tentativas
- resultado

O objetivo é permitir futura criação de dashboards e monitoramento em tempo real.

---

# Evolução

A evolução da plataforma deve seguir sempre esta ordem de prioridade:

1. Melhorar Policies.
2. Melhorar Skills reutilizáveis.
3. Melhorar Capabilities.
4. Melhorar Workflows.
5. Melhorar Agentes.
6. Criar novos agentes apenas quando realmente necessário.

Adicionar uma Skill costuma ser preferível a criar um novo agente.

---

# Critério para criação de agentes

Criar um novo agente apenas quando existir uma diferença significativa de papel ou forma de raciocínio.

Nunca criar um agente apenas para encapsular uma tecnologia.

Pergunta orientadora:

"O agente pensa diferente ou apenas utiliza ferramentas diferentes?"

Se apenas utiliza ferramentas diferentes, normalmente trata-se de uma nova Skill ou Capability.

---

# Objetivo de longo prazo

A plataforma deve evoluir para um ecossistema onde:

- Agentes representam papéis.
- Skills representam conhecimento.
- Capabilities representam comportamentos reutilizáveis.
- Tools representam execução.
- Policies representam regras globais.
- Gates representam critérios objetivos.
- Workflows representam processos.

Essa separação deve permitir crescimento contínuo da plataforma sem aumento proporcional da complexidade.