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
5. **Plano e domínio.** Toda entrada externa tem linha na tabela de domínio com fonte; todo `A<n>` está no molde
   fixo (entrada, domínio, saída, erro, fonte, camada). Critério vago reprova. Pendência no domínio para a feature.
6. **Camadas.** Todo critério tem teste em cada camada declarada; parser e cálculo têm `prop`; critério `e2e` tem
   arquivo em `e2e` do estado. O gate [testes-revisados](../../../../harness-ada/gate/testes-revisados.md) também
   dá FAIL nisso.
7. **Bordas.** Checklist de bordas ([testing](../../../../harness-ada/capability/testing.md#checklist-de-bordas))
   preenchido por entrada; ao menos uma rejeição por entrada, com o erro exato.
8. **Proteções.** O arquivo de implementação (esboço) não foi tocado por quem escreveu o teste.
9. Devolva a revisão no formato abaixo; o orquestrador grava em `docs/plano/<feature>/revisao.md`.

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
- Cobertura de 100% não prova domínio; quem prova é a rejeição testada e o gate
  [mutacao](../../../../harness-ada/gate/mutacao.md).

## Exemplos práticos

Ver [references/exemplos.md](references/exemplos.md).
