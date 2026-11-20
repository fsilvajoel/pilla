# Refinamento funcional E9-F04

refinador: refiner
rodada: 1

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato.
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e implementar sem adivinhar.

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T07 | ajustado | ajustado |
| E9-T08 | ajustado | ajustado |

## Veredito
ajustado

## Mudanças
- `docs/plano/E9.yaml` E9-T07: ampliou `refs`, `readFirst` e `allowedPaths`; corrigiu `done` para C1–C22, exclusão sem promoção, validação PIX e chave repetida.
- `docs/plano/E9.yaml` E9-T08: alinhou `allowedPaths`, `protectedTests`, `readFirst` e `checks` ao plano e à migration; incluiu remoção da UNIQUE e proteção dos testes SQL.
- `docs/plano/E9-F04/plano.md`: removeu descrições divergentes sobre promoção, validação por tipo e UNIQUE PIX, mantendo as decisões aprovadas do Joel.

## Pendências de PM
- nenhuma
