---
name: editar-arquivo
description: Como editar arquivos com segurança na implementação de uma feature (ler antes, Edit com trecho único e mínimo, Write só para arquivo novo ou pequeno, diff vazio é falha, checks a cada edição). Use na etapa implement.
---

# Skill: editar arquivo

## Propósito
Fazer a menor edição correta que cumpre o plano, sem sair do escopo e sem deixar erro de lint, tipo ou import
para outra etapa.

## Contexto de uso
- Etapa `implement` do workflow [feature](../../../Harness-adaV1/workflow/feature.md), subagente `implementer`.
- Qualquer alteração de arquivo existente pedida pelo plano da feature.

## Passos recomendados
1. **Leia antes de editar.** Abra o arquivo inteiro (ou o trecho, se for grande) antes da primeira edição e de novo
   depois de cada edição que falhar.
2. **Edite por trecho com `Edit`.** O `old_string` é **único** no arquivo e **mínimo**: as linhas que mudam e o
   contexto necessário para ficar único. Se aparece mais de uma vez, acrescente uma linha vizinha.
3. **`Write` só para arquivo novo ou pequeno.** Reescrever arquivo grande arrisca truncar o conteúdo; arquivo grande
   se edita por trecho.
4. **Escreva só no escopo do plano.** Nunca em teste revisado (gate
   [testes-revisados](../../../Harness-adaV1/gate/testes-revisados.md)), nunca em `.env` nem fora do repositório
   (bloqueado pelo hook de `.claude/settings.json`).
5. **Sem marca de esboço.** Não deixe texto de esboço (`não implementado`, `TODO`, `@stub`) no código entregue.
6. **Rode os checks a cada edição** (`commands` do `harness.project.yaml`: teste, typecheck, lint) e corrija o que for
   lint, tipo ou import antes de seguir.
7. **Confira o diff.** Diff vazio é **falha**, não sucesso: o plano pediu mudança.

## Limitações
- `Edit` exige texto idêntico ao do arquivo, inclusive espaços; copie do que foi lido, não de memória.
- Esta skill não decide o que mudar; isso vem do plano e dos testes revisados.
- Regras gerais de edição e escopo: [policy/editing.md](../../../Harness-adaV1/policy/editing.md) e
  [policy/quality.md](../../../Harness-adaV1/policy/quality.md).

## Exemplos práticos
- Ruim: `old_string` = `return null;` (aparece 3 vezes). Bom: a assinatura da função + `return null;`.
- Ruim: `Write` num arquivo de 600 linhas para mudar uma. Bom: `Edit` só no trecho.
- Ruim: terminar com "tudo já estava certo" e diff vazio. Bom: reler o plano; se de fato não há o que mudar,
  devolver ao orquestrador explicando o motivo.
- Ruim: deixar `throw new Error("esboço: não implementado")` em outra função do arquivo. Bom: remover ao implementar.
