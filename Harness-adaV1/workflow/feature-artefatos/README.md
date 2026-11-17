# Artefatos de uma feature

Moldes dos arquivos que o workflow [feature](../feature.md) produz em `<pasta do plano>/<ID da feature>/`.
Copie o molde, troque os `<...>` e apague o que não se aplica.

| Etapa | Arquivo | Quem escreve |
|---|---|---|
| plan | [plano.md](plano.md) | planner |
| tests | [testes.md](testes.md) | reviewer (escreve; outra instância revisa e assina) |
| audit | [auditoria.md](auditoria.md) | reviewer |
| review | [revisao-final.md](revisao-final.md) | coordinator |
| todas | `estado.json` ([estado.md](estado.md)) | motor |

Ordem: `plan → tests → (revisão dos testes) → implement → audit → review`. A implementação só começa com os testes
prontos e revisados (skill [revisar-teste](../../skill/revisar-teste/SKILL.md)).
