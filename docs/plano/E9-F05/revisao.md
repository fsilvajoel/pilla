# Refinamento funcional E9-F05

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato.
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e implementar sem adivinhar.

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T09 | ajustado | ajustado |
| E9-T10 | ajustado | ajustado |

## Veredito
ajustado

## Mudanças
- `docs/plano/E9-F05/plano.md` (A2): completou a ficha literal, IDs, telefones, CPFs, endereços, PIX e timestamps do seed (fonte: contrato c1f5148 e decisões do Joel de 20/11/2026).
- `docs/plano/E9-F05/plano.md` (A3/C3): informou os valores literais e a ordenação por `createdAt asc, id asc` (fonte: decisão do Joel e RFC-005 §3).
- `docs/plano/E9-F05/plano.md` (A4/C4): separou pessoa inativa e indicado importado com CPF nulo, preservando `active:false` em resumos (fonte: decisão do Joel de 20/11/2026 e RN-P01).
- `docs/plano/E9-F05/plano.md` (A6/C6): definiu a contagem por `client.query` do PGlite e o limite `<= 4`, incluindo cenário sem relacionamentos (fonte: card E9-T10 e ausência de N+1).
- `docs/plano/E9-F05/plano.md`: removeu arquivos de outras features e deixou somente os quatro arquivos de produção desta feature (fonte: escopo da E9-F05).
- `docs/plano/E9-F05/plano.md`: separou divergências com outras features das pendências de PM (fonte: revisão funcional).
- `docs/plano/E9.yaml` (E9-T09): removeu `contracts`, alinhou o `done` aos C1–C6 e incluiu o ajuste protegido de C8/A8 em `allowedPaths` (fonte: contrato c1f5148 e decisões do Joel).
- `docs/plano/E9.yaml` (E9-T10): limitou `allowedPaths`, alinhou `protectedTests`, `readFirst`, `refs` e `done` ao plano (fonte: plano da E9-F05 e decisões do Joel).

## Pendências de PM
- nenhuma; a fila `pm_queue` não foi alterada.
