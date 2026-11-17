---
name: escrever-teste
description: Como escrever os testes de uma feature antes da implementação (cenário C<n> ligado a A<n>, expect-red contra o esboço, asserção exata, sem ler a implementação). Use na etapa tests de uma feature (subagente test-writer).
---

# Skill: escrever teste

## Propósito
Transformar cada critério de aceite do plano em teste executável que **decide o pronto**. O teste nasce antes da
implementação e tem de falhar contra o esboço; se passar sem implementação, não prova nada.

## Contexto de uso
- Etapa `tests` do workflow [feature](../../../Harness-adaV1/workflow/feature.md), subagente `test-writer`.
- Não use para corrigir teste já revisado: alteração derruba a revisão (gate [testes-revisados](../../../Harness-adaV1/gate/testes-revisados.md)).

## Passos recomendados
1. **Leia o plano, não o código.** Entrada: critérios `A<n>`, cenários `C<n>`, contrato (tipos e assinaturas) e o
   esboço. **Não leia a implementação** nem procure como ela calcula: o teste descreve o contrato.
2. **Um teste por cenário, com nome localizável.** O nome começa pelo ID: `it("C3 (A2): recusa quantidade zero", ...)`.
   Todo `C<n>` do plano tem teste; todo teste cita o `A<n>` que cobre.
3. **Valor esperado vem do plano.** Copie o número ou o objeto exato do plano ou do documento de regra. Quem escreve
   o teste **nunca calcula valor**; se o plano não traz o valor, pare e devolva a dúvida ao orquestrador.
4. **Asserção exata.** Use `toBe` para escalar e `toEqual`/`toStrictEqual` para objeto. Nunca só `toBeTruthy`,
   `toBeDefined` ou `not.toThrow` como única prova do cenário.
5. **Dados isolados.** Copie fixtures com `structuredClone(base)`, não `JSON.parse(JSON.stringify(base))`
   (o round-trip perde `Date`, `undefined`, `Map`, `BigInt`).
6. **Escreva só no arquivo de teste.** O arquivo de implementação (esboço criado pelo orquestrador) fica intocado.
7. **Expect-red.** Rode `pnpm gate expect-red <feature>` contra o esboço: todos os testes novos falham
   pela asserção ou pelo erro do esboço, não por sintaxe, import ou tipo (gate [expect-red](../../../Harness-adaV1/gate/expect-red.md)).
8. Registre arquivo, cenários e resultado em [testes.md](../../../Harness-adaV1/workflow/feature-artefatos/testes.md).

## Limitações
- O teste prova o contrato que o plano descreve; critério ambíguo no plano vira teste ambíguo. Corrija o plano.
- Expect-red mostra que o teste distingue esboço de implementação, não que cobre todos os casos; a auditoria
  confere lacunas depois.
- Regras gerais (validar antes de concluir, escopo, evidência): [policy/quality.md](../../../Harness-adaV1/policy/quality.md).

## Exemplos práticos
- Ruim: `expect(resultado).toBeTruthy()`. Bom: `expect(resultado).toEqual({ status: "recusado", motivo: "quantidade" })`.
- Ruim: `it("valida quantidade", ...)`. Bom: `it("C3 (A2): recusa quantidade zero", ...)`.
- Ruim: `const caso = JSON.parse(JSON.stringify(base))`. Bom: `const caso = structuredClone(base)`.
- Ruim: abrir o arquivo de implementação para "ver o que ele retorna". Bom: tirar o retorno do contrato no plano.
- Exemplo de esboço contra o qual o teste deve falhar:

```ts
export function validarPedido(_pedido: Pedido): Resultado {
  throw new Error("esboço: não implementado");
}
```
