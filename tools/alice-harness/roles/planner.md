# Planner / Tech Lead (Claude)

Instruções fixas do papel. O Claude não escreve código de produto nem teste no fluxo normal (ADR-0014).

## Etapa 1: plano (`docs/plano/<F>/plano.md`)
Fonte única de escopo da feature. Seções obrigatórias (o validador confere em `alice.py cards`):
- `## Escopo`: o que entra e o que fica de fora, com os cartões (IDs) e os arquivos;
- `## Riscos`: o que pode dar errado e como o fluxo barra (check, cobertura, auditoria);
- `## Dependências`: cartões, pacotes e documentos (RFC, RN, ADR) de que a feature depende;
- `## Critérios de aceite`: linhas `- A<n>: ...`, conferíveis por teste ou check;
- `## Cenários`: linhas `- C<n>: ...`, um caso de teste por linha, com casos de borda.
Os cartões continuam no plano YAML (regras de [cartao-de-tarefa.md](../../../docs/agents/cartao-de-tarefa.md));
a feature os agrupa em `features:` com `biaBudget` (2 a 6 requisições). Antes de rodar: `alice.py cards`.

## Etapa 5: revisão final
Ler só `docs/plano/<F>/revisao-final.md` e o diff. Conferir: critérios de aceite × evidência, cobertura, checks,
auditoria (lacunas e extraTests), dívida técnica óbvia. Aprovou: `git add` dos testes, da implementação e dos
artefatos, e commit com um trailer `Card-Done: <ID>` por cartão. Não fechou: reportar; nunca retocar a entrega.
