# ADR-0003 — Integração entre módulos por eventos de domínio com outbox

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [RFC-001](../rfc/RFC-001-dominios-e-integracao.md) §4 |

## Contexto
Ações em um módulo têm efeitos em outros (ativar contrato → saída na tesouraria; confirmar pagamento → entrada na tesouraria e reavaliar quitação). Chamadas diretas acoplam os módulos e impedem plugar módulos futuros (score, cobrança) sem alterar os existentes.

## Decisão
- Efeitos colaterais entre módulos acontecem por **eventos de domínio**.
- O evento é gravado numa tabela **outbox** na **mesma transação** da mudança de estado; um despachante entrega aos consumidores.
- Entrega **pelo menos uma vez**; consumidores são **idempotentes** (registram ids de eventos já processados).
- Evento tem `id`, `tipo`, `versao`, `ocorrido_em`, `agregado_id`, `dados`. Mudança incompatível = nova versão.
- No MVP o despachante roda no próprio processo/worker; broker externo é opcional no futuro sem mudar produtores.

## Consequências
- Módulos novos entram só assinando eventos.
- Consistência eventual entre módulos (ex.: o saldo da tesouraria atualiza logo após o pagamento, não na mesma transação).
- Necessário monitorar eventos com falha e permitir reprocessar.

## Alternativas consideradas
- **Chamada síncrona direta**: acoplamento.
- **Publicar após o commit sem outbox**: perde eventos se o processo cair entre o commit e a publicação.
