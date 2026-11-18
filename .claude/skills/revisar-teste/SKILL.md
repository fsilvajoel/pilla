---
name: revisar-teste
description: Como revisar testes escritos por um agente antes de a implementação começar (expect-red, checklist do done com evidência por linha, assinatura com sha). Use na etapa de revisão de testes de uma feature.
---

# Skill: revisar teste

## Propósito
Garantir que os testes de uma feature decidem o pronto **antes** de o executor implementar. Teste fraco aprova
implementação errada; a revisão é o que impede isso.

## Contexto de uso
- Depois da etapa `tests` de uma feature e antes da etapa `implement`.
- Subagente `reviewer` (só leitura); o orquestrador grava a revisão e assina.

## Passos recomendados
1. **Expect-red primeiro (mecânico, gate [expect-red](../../../../harness-ada/gate/expect-red.md)).** Confira em
   `estado.json` que `pnpm gate expect-red <feature>` passou: todo teste novo falha agora (o esboço lança erro).
   Se algum já passa, reprove sem ler o resto.
2. **Assinatura.** Aprovada a revisão, o orquestrador roda `pnpm gate tests-reviewed <feature> --sign`, que grava o
   sha do blob (`git hash-object`) de cada teste. Se o arquivo mudar depois, a assinatura cai e a revisão precisa ser
   refeita (gate [testes-revisados](../../../../harness-ada/gate/testes-revisados.md)).
3. **Um item por linha do `done`.** Para cada linha, marque `[x]` ou `[ ]` e escreva a **evidência com números de
   linha** do teste. Item sem evidência é `[ ]`.
4. **Cenários.** Confira que cada cenário do plano (`C<n>`) tem um teste com nome localizável e as regras de
   [escrever-teste](../escrever-teste/SKILL.md) (asserção exata, sem ler a implementação).
5. **Proteções.** O arquivo de implementação (esboço) não foi tocado por quem escreveu o teste.
6. Devolva a revisão no formato abaixo; o orquestrador grava em `docs/plano/<feature>/revisao.md`.

## Formato

```
# Revisão <feature>

revisor: reviewer
arquivo: <caminho do teste> <sha do blob>

- [x] <linha do done> — <evidência: linhas N-M e o que mostram>
- [ ] <linha do done> — <o que falta>
```

## Limitações
- Ler o teste não prova que ele falha; só o check mecânico do passo 1 prova.
- A revisão vale para um sha; qualquer edição no teste exige revisão nova.
- Quem escreveu o teste não revisa o próprio teste.

## Exemplos práticos
Ver [references/exemplos.md](references/exemplos.md).
