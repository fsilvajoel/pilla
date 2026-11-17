# Agentes

Cada arquivo define um **papel**, não uma pessoa nem um modelo. Quem executa cada papel, e com qual perfil de
modelo, fica no bloco `roles:` do `harness.project.yaml`. Trocar o executor é editar o yaml; este diretório não muda.

| Papel | Responsabilidade | Workflows |
|---|---|---|
| [coordinator](coordinator.md) | conduz o workflow, decide a próxima etapa, dá o aceite final | [coordination](../workflow/coordination.md), [feature](../workflow/feature.md) |
| [planner](planner.md) | escopo, critérios de aceite, cenários e cartões | feature: plan |
| [reviewer](reviewer.md) | escreve e revisa testes, audita a entrega; nunca calcula valor | feature: tests, revisão dos testes, audit |
| [developer](developer.md) | implementa o cartão dentro do escopo | feature: implement |
| [platform](platform.md) | corrige problema estrutural do harness | [delegation](../workflow/delegation.md) |

Formato de cada arquivo: [_modelo.md](_modelo.md). Regras comuns a todos os papéis ficam em [policy/](../policy/README.md).
