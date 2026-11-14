# ADR-0002 — Monólito modular com fronteiras de domínio

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | [RFC-001](../rfc/RFC-001-dominios-e-integracao.md) |

## Contexto
O produto vai crescer em módulos (crédito, recebimentos, tesouraria, score, cobrança…). Precisamos de domínios claros e escaláveis, mas um MVP com microsserviços traria custo operacional (rede, deploy, consistência distribuída) sem benefício agora.

## Decisão
- Uma única aplicação implantável, dividida em **módulos por domínio** (M0, M1, M2, M3, M4, M6 da RFC-001).
- Cada módulo tem: interface pública (comandos e consultas), modelo interno e suas próprias tabelas (prefixo ou schema por módulo).
- Um módulo **não importa** o interior de outro e **não acessa** tabelas de outro; usa a interface pública ou eventos.
- As fronteiras são **verificadas automaticamente** (teste de arquitetura/lint) no CI.
- Sem chaves estrangeiras entre schemas de módulos diferentes; referências entre módulos são por id.

## Consequências
- Um módulo pode ser extraído para serviço próprio no futuro sem reescrever regras.
- Transações locais simples dentro do módulo.
- Exige disciplina: atalho "só dessa vez" acessando tabela alheia é proibido.
- Integridade entre módulos validada na aplicação, não no banco.

## Alternativas consideradas
- **Microsserviços**: complexidade operacional prematura.
- **Monólito em camadas sem módulos**: domínios se misturam; difícil evoluir.
