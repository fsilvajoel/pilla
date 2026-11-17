# Policy: security

## Objetivo
Manter o harness seguro e previsível.

## Regras
- Nunca expor segredo em log, pedido a modelo ou arquivo versionado (gate [redact](../gate/redact.md)).
- Arquivo de segredos do projeto alvo não é lido nem enviado a modelo.
- Acesso a arquivo sempre com escopo (gate [edit-guard](../gate/edit-guard.md)).
- Ação externa ou privilegiada passa por portão explícito (gate [ssh-gate](../gate/ssh-gate.md)).
- Sem evidência, a decisão é bloquear (falhar fechado).
