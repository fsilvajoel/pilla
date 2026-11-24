# Modelo de documentação e cartões

## Cadeia de especificações

```text
PRD
  -> ADR
  -> RFC
  -> Feature Plan
  -> Card
  -> Test Contract
  -> Implementation Contract
  -> Evidence
```

## PRD

Conteúdo mínimo:

- problema;
- atores;
- objetivos mensuráveis;
- fora de escopo;
- fluxos;
- requisitos funcionais;
- requisitos não funcionais;
- critérios de aceite;
- dependências;
- entradas;
- saídas;
- erros;
- segurança;
- acessibilidade;
- observabilidade;
- performance;
- compatibilidade;
- e2e crítico;
- fontes;
- métricas;
- decisões pendentes.

Nenhum requisito pode ser apenas “deve lidar adequadamente”.
Um critério precisa ser verificável.

## ADR

Conteúdo mínimo:

- contexto;
- decisão;
- alternativas;
- consequência;
- risco;
- owner;
- escopo;
- compatibilidade;
- fonte.

Uma ADR não define detalhes de implementação sem indicar como implementá-los no RFC.

## RFC

Conteúdo mínimo:

- desenho técnico;
- módulos;
- contratos;
- banco;
- migrações;
- compatibilidade;
- API;
- segurança;
- observabilidade;
- rollback;
- fases;
- testes;
- riscos.

## Plano de feature

Conteúdo mínimo:

- escopo;
- contrato;
- tabelas de domínio;
- fontes de regra;
- arquivos de produção;
- classificação TDD;
- critérios A<n>;
- camadas;
- cenários C<n>;
- arquivos de teste;
- allowedPaths;
- protectedTests;
- dependências;
- gates aplicáveis;
- e2e.

## Tipos de arquivo

| Classificação | Quando | Comportamento |
|---|---|---|
| `tdd` | regra, cálculo, validação, contrato, adaptador | teste antes, cobertura e mutação conforme domínio |
| `dispensa-estilo` | somente layout, apresentação e estilo | revisão visual, sem cobertura funcional artificial |
| `dispensa-biblioteca` | biblioteca intacta ou componente sem mudança de comportamento | revisão visual ou integração conforme risco |

Arquivo com `if`, cálculo ou validação não é dispensado.
A lógica entra em um arquivo `tdd`; somente a composição visual pode ficar dispensada.

## Quando dispensar TDD

TDD não é obrigatório para:

- CSS;
- layout sem condição;
- composição visual sem comportamento novo;
- componente copiado de biblioteca sem prop ou comportamento novo;
- documentação;
- conteúdo estático;
- mudanças mecânicas com equivalência verificável.

TDD continua obrigatório para:

- validação;
- estado que muda saída;
- regra de negócio;
- cálculo;
- parser;
- contrato público;
- segurança;
- acesso;
- tratamento de erro;
- integração;
- correção de defeito.

## Modelo de cartão

```yaml
id: E9-F02-T01
feature: E9-F02
kind: implement
type: domain

goal: Validar e normalizar o filtro de busca

inputs:
  - id: SEARCH_TERM
    source: request
    format: string
    required: false
    domain:
      min_length: 1
      max_length: 120
      rejected:
        - value: ""
          error: "EMPTY_SEARCH"
        - value: " "
          error: "EMPTY_SEARCH"

outputs:
  - id: FILTERED_RESULT
    type: paged-list

acceptance:
  - id: A1
    statement: Termos válidos retornam resultados do domínio
    layers: [unit, prop, mut]

files:
  read:
    - src/search/service.ts
  allowed_write:
    - src/search/filter.ts
  protected_tests:
    - src/search/filter.test.ts
  tdd:
    - src/search/filter.ts
  exempt: []

dependencies:
  - E9-F02-T00

checks:
  - pnpm test src/search/filter.test.ts
  - pnpm gate expect-red E9-F02
  - pnpm gate coverage E9-F02

evidence:
  - test_output
  - diff
  - gate_results
```

## Linters

### `plan-lint`

Falha em:

- critério vago;
- entrada sem domínio;
- A<n> sem camadas;
- erro sem texto;
- fonte ausente;
- arquivo sem classificação;
- path inexistente;
- dependência sem cartão;
- cenário sem critério.

### `card-lint`

Falha em:

- DoR ausente;
- DoD ausente;
- allowedPaths vazio;
- protectedTests ausente;
- skill inexistente;
- check não configurado;
- cartão visual sem skill;
- lógica visual em arquivo visual.

### `artifact-lint`

Falha em:

- estado não deriva do event log;
- gate sem evidência;
- testSha divergente;
- implementação sem gate obrigatório;
- commit sem stage concluída.
