---
name: editar-arquivo
description: Como editar arquivos com segurança na implementação de um cartão (ler antes, edit_file com trecho único e mínimo, write_file só para arquivo novo ou pequeno, diff vazio é falha, checks a cada edição). Use na etapa implement.
---

# Skill: editar arquivo

## Propósito
Fazer a menor edição correta que cumpre o cartão, sem quebrar a chamada de ferramenta, sem sair do escopo e sem
deixar erro de lint, tipo ou import para outro papel.

## Contexto de uso
- Etapa `implement` do workflow [feature](../../workflow/feature.md), papel developer.
- Qualquer cartão `kind: implement` ou `docs` que altera arquivo existente.

## Passos recomendados
1. **Leia antes de editar.** Abra o arquivo inteiro (ou o trecho, se for grande) antes da primeira edição e de novo
   depois de cada edição que falhar.
2. **Edite por trecho com `edit_file`.** O `old` é **único** no arquivo e **mínimo**: as linhas que mudam e o
   contexto necessário para ficar único. Se o `old` aparece mais de uma vez, acrescente uma linha vizinha.
3. **`write_file` só para arquivo novo ou pequeno.** Reescrever arquivo grande quebra a chamada (saída cortada ou
   arquivo truncado); arquivo grande se edita por trecho.
4. **Escreva só em `allowedPaths`.** Nunca em teste protegido, arquivo de `generatedPaths` ou arquivo gerado por
   ferramenta (gate [edit-guard](../../gate/edit-guard.md)).
5. **Sem marca de esboço.** Não deixe texto de esboço (`não implementado`, `TODO`, `@stub`) no código entregue.
6. **Rode os checks a cada edição** (`checks` do cartão, montados de `commands` do `harness.project.yaml`) e corrija
   sozinho o que for lint, tipo ou import antes de seguir.
7. **Confira o diff.** Diff vazio ou resposta `NO_CHANGE` é **falha**, não sucesso: o cartão pediu mudança.

## Limitações
- `edit_file` exige texto idêntico ao do arquivo, inclusive espaços; copie do que foi lido, não de memória.
- Esta skill não decide o que mudar; isso vem do cartão e dos testes revisados.
- Regras gerais de edição e escopo: [policy/editing.md](../../policy/editing.md) e [policy/quality.md](../../policy/quality.md).

## Exemplos práticos
- Ruim: `old` = `return null;` (aparece 3 vezes). Bom: `old` = a assinatura da função + `return null;`.
- Ruim: `write_file` num arquivo de 600 linhas para mudar uma. Bom: `edit_file` só no trecho.
- Ruim: terminar com "tudo já estava certo" e diff vazio. Bom: reler o cartão; se de fato não há o que mudar,
  devolver `card_error` explicando o motivo.
- Ruim: deixar `throw new Error("esboço: não implementado")` em outra função do arquivo. Bom: remover ao implementar.
