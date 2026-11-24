# Diagnóstico da V1

## O que funcionou

| Área | Evidência |
|---|---|
| Gates | pegaram `.env.example` desatualizado, dependência não aprovada e asserções fracas |
| Expect-red | rejeitou erros de import e teste que passava sem implementação |
| Refinamento | levou uma feature a ajuste, colocou perguntas em fila e registrou respostas |
| Rastreabilidade | tentou registrar workers, tentativas, escaladas e dívida |
| Commits | muitos commits pequenos, associados à feature |

## O que não virou linha de produção

### 1. A feature parou no fluxo

Uma feature chegou à implementação enquanto etapas posteriores continuavam pendentes.
Isso expôs que estado e git não eram uma máquina de estados forte:

```text
tests = pending
testReview = pending
review = pending
expect-red = FAIL
implement = done
```

O risco não era apenas uma coluna errada.
Era a garantia de prontidão ter sido contradita pela própria execução.

### 2. Workers baratos gastaram o orquestrador caro

Um worker barato gastou centenas de milhares de tokens, mas não entregou um plano aprovado.
O plano foi reescrito pelo Claude.

Essa operação ainda fazia sentido como tentativa controlada, mas não como saída final:

```text
worker tenta
  -> falha
  -> orquestrador reconstrói
  -> orquestrador interpreta falta
  -> orquestrador tenta novamente
```

### 3. A revisão não executou o teste errado

A revisão textual encontrou problema depois dos testes serem escritos.
O teste fraco passava com a implementação quebrada.

A revisão precisa executar ou provocar testes mutantes antes de assinar o contrato.

### 4. Relatórios sem artefato

A declaração “lint passou” ou “320 testes passaram” não era evidência.
O orquestrador precisava rodar novamente ou reconstruir o resultado.

A evidência aceita precisa conter:

- comando;
- exit code;
- arquivo de saída;
- hash da entrada;
- hora;
- hash da saída.

### 5. Estado sujo vazou entre sessões

O índice, stash, worktrees e branch errada não eram parte de uma preparação determinística.
Uma sessão podia herdar o trabalho de outra.

### 6. O plano não tinha lint de formato

O plano aceitava:

- caminhos inexistentes;
- gates incompatíveis com cartão;
- schema em outra branch;
- decisões pendentes em arquivo incidental;
- cartão apontando para arquivo não criado.

Esses problemas deveriam falhar no momento do commit do plano.

### 7. Estado era escrito para satisfazer gate

Um commit implementava o código e outro “marcava implement done”.
Isso separou artefato e estado e permitiu que o estado fosse ajustado depois.

Em V2:

```text
commit só após stage concluir
estado deriva de evento
evento aponta para gate e diff
```

## Diagnóstico em uma frase

A V1 separou bem papéis e conhecimento, mas deixou o orquestrador pagar o custo de:

- máquina de estados;
- auditor;
- conciliador;
- gerenciador de retry;
- gerente de worktree;
- tradutor de stdout;
- sincronizador de estado.

É essa camada que precisa virar Python.

## Gates que devem continuar

Manter por serem guardrails úteis:

- hooks bloqueantes;
- expect-red;
- testes revisados;
- hashes dos testes;
- cobertura;
- mutação;
- E2E;
- revisão final;
- consistência de estado;
- `pnpm verify`.

## Gate que deve mudar

O gate não desaparece.
A forma de usá-lo muda:

| Cenário | V1 | V2 |
|---|---|---|
| Worker falha | orquestrador decide | fallback configurado |
| Worker diz passou | reconferir texto | validar evidência |
| Índice sujo | sessão herda | worktree isolada |
| Teste fraco | revisão posterior | mutação antes da assinatura |
| UI sem lógica | TDD completo | workflow visual ou lógica extraída |
| Estado manual | gráfico pode mentir | estado derivado do event log |
