# Policy: security

## Objetivo
Manter o harness seguro e previsível.

## Regras
- Nunca expor segredo em log, pedido a modelo ou arquivo versionado (gitleaks no pre-commit; o gate [edit-guard](../gate/edit-guard.md) bloqueia `.env`).
- Arquivo de segredos do projeto alvo não é lido nem enviado a modelo.
- Acesso a arquivo sempre com escopo (gate [edit-guard](../gate/edit-guard.md)).
- Ação externa, privilegiada ou em produção exige ok explícito do humano antes de rodar.
- Sem evidência, a decisão é bloquear (falhar fechado).
