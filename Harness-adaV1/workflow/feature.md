# Workflow: feature

## Objetivo
Entregar uma feature numa sequência controlada em que **os testes revisados decidem o pronto** e a implementação
só começa depois deles.

## Quem conduz
O **orquestrador** é a sessão principal do Claude Code. Ele segue esta lista, chama um subagente por etapa
(`.claude/agents/`), roda os gates e grava o estado. Os subagentes não chamam uns aos outros.

| Subagente | Etapas |
|---|---|
| [planner](../../.claude/agents/planner.md) | plan |
| [test-writer](../../.claude/agents/test-writer.md) | tests |
| [reviewer](../../.claude/agents/reviewer.md) | revisão dos testes, revisão final (somente leitura) |
| [implementer](../../.claude/agents/implementer.md) | implement |

## Pasta da feature
Tudo da feature fica em `docs/plano/<feature>/` (moldes em [feature-artefatos/](feature-artefatos/README.md)):
`plano.md`, `testes.md`, `revisao.md` e `estado.json` ([formato](feature-artefatos/estado.md)).

## Lista do orquestrador
Marque cada item na ordem. Gate FAIL ou SKIP bloqueia o item seguinte; a mensagem do gate diz o que falta.

### 1. plan
- [ ] Chamar **planner** com o ID da feature.
- [ ] Conferir `plano.md`: escopo, contrato (arquivo + assinatura), todo `A<n>` verificável, todo `C<n>` com
      valor esperado de fonte citada, arquivos de teste previstos. Pendência no plano = parar e perguntar.
- [ ] Criar o **esboço** do contrato (assinaturas que lançam `Error("esboço: não implementado")`) e excluí-lo
      da cobertura enquanto não for implementado.
- [ ] Criar `estado.json` com `feature`, `tests` (caminhos dos testes previstos) e `stages.plan = done`.

### 2. tests
- [ ] Chamar **test-writer** (skill [escrever-teste](../../.claude/skills/escrever-teste/SKILL.md)).
- [ ] Gravar em `estado.json` os `scenarios` (`C<n>` → teste) e ajustar `tests` se a lista mudou.
- [ ] `pnpm gate expect-red <feature>` → PASS (gate [expect-red](../gate/expect-red.md)).

### 3. revisão dos testes
- [ ] Chamar **reviewer** (skill [revisar-teste](../../.claude/skills/revisar-teste/SKILL.md)); gravar a saída em
      `revisao.md`.
- [ ] Reprovado: voltar à etapa 2 com a lista do reviewer.
- [ ] Aprovado: `pnpm gate tests-reviewed <feature> --sign` (grava `testShas`).

### 4. implement
- [ ] Bloqueio: só começa com `gates.expect-red` e `testShas` gravados no estado.
- [ ] Tirar o esboço da exclusão de cobertura.
- [ ] Chamar **implementer** (skill [editar-arquivo](../../.claude/skills/editar-arquivo/SKILL.md)).
- [ ] `pnpm gate tests-reviewed <feature>` → PASS (gate [testes-revisados](../gate/testes-revisados.md)).
      Teste alterado depois da revisão volta para a etapa 3.
- [ ] `pnpm gate coverage <feature>` → PASS (gate [cobertura](../gate/cobertura.md)).

### 5. revisão final
- [ ] Chamar **reviewer** para o diff; acrescentar a saída a `revisao.md` (gate [auditoria](../gate/auditoria.md),
      manual).
- [ ] Reprovado: voltar à etapa 4 (ou 2, se faltar teste).

### 6. fechamento
- [ ] `pnpm verify` verde (gate [done-checks](../gate/done-checks.md)).
- [ ] `stages.review = done` no estado; commit com hooks, citando o ID da feature.

Regras que valem em todas as etapas: [policy/quality.md](../policy/quality.md).

## Pronto quando
Todos os gates abaixo estão **PASS**; qualquer FAIL ou SKIP bloqueia o aceite.

- [ ] [expect-red](../gate/expect-red.md): PASS antes da implementação.
- [ ] [testes-revisados](../gate/testes-revisados.md): sha atual de cada teste bate com o sha assinado.
- [ ] [cobertura](../gate/cobertura.md): limites do `vitest.config` atendidos, sem teste pulado e sem 0/0.
- [ ] [auditoria](../gate/auditoria.md): veredito `aprovado` em `revisao.md`.
- [ ] [done-checks](../gate/done-checks.md): `pnpm verify` verde.

## Falhas
Status de etapa e o que fazer em cada falha: [feature-artefatos/estado.md](feature-artefatos/estado.md#status-das-etapas).
