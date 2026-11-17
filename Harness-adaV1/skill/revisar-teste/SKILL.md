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
- Na revisão de cartão `test-author`.

## Passos recomendados
1. **Expect-red primeiro (mecânico, gate [expect-red](../../gate/expect-red.md)).** Rode os checks do cartão: todo teste novo tem de falhar agora (o esboço lança
   erro) e passar com uma implementação correta. Se algum já passa, reprove sem ler o resto.
2. **Assine o arquivo.** Anote o caminho e o sha do blob (`git hash-object <arquivo>`). Se o arquivo mudar depois da
   revisão, a assinatura cai e a revisão precisa ser refeita (gate [testes-revisados](../../gate/testes-revisados.md)).
3. **Um item por linha do `done`.** Para cada linha, marque `[x]` ou `[ ]` e escreva a **evidência com números de
   linha** do teste. Item sem evidência é `[ ]`.
4. **Cenários.** Confira que cada cenário do plano (`C<n>`) tem um teste com nome localizável e as regras de
   [escrever-teste](../escrever-teste/SKILL.md) (asserção exata, sem ler a implementação).
5. **Proteções.** O arquivo de implementação não foi tocado (vem de `allowedPaths`/`protectedTests`).
6. Grave a revisão em `<pasta de revisões>/<ID>.md` no formato abaixo.

## Formato

```
# Revisão <ID>

revisor: <papel> <executor em roles do yaml> <id da geração>
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
