# E6-F02: componente da tela de simulação

Plano da feature (etapa 1, ADR-0014). Cartões em `docs/plano/E6.yaml`; referências: PRD-001 RF-10 (esboço
`docs/prd/telas/simulacao-contrato.png`), RFC-004 §5, ADR-0013 (React Hook Form, cálculo no navegador).

## Escopo

- E6-T05 (Bia) e E6-T06 (Alice): `apps/web/components/loan-simulation.tsx`, o componente cliente
  `LoanSimulation` com formulário, botão "Simular", resumo e tabela do cronograma. Usa `toSimulateRequest` e
  `simulate` da E6-F01.
- Fora: a página `app/(admin)/loans/simulate/page.tsx` (depende da decisão sobre a data de desembolso), campo
  Cliente, botões Cancelar e Criar contrato (RF-11), "Por parcela: x%".

## Riscos

- Submit do React Hook Form é assíncrono: o teste espera o resultado com `findBy*`.
- Cobertura 0/0 pela exclusão `stub E6-T06`: o check do implement passa `--coverage.exclude=none`.
- Componente grande para um cartão: o cálculo e a conversão ficam na E6-F01; aqui só tela.

## Dependências

- E6-F01 entregue (`apps/web/lib/simulation.ts` e `apps/web/lib/simulation-form.ts`).
- `formatReais` e `isoDate` de `@pilla/finance`; `react-hook-form` já está no `apps/web/package.json`.

## Critérios de aceite

- A1: os cinco campos têm rótulo e há um botão "Simular".
- A2: o exemplo da RFC-004 §5 mostra R$ 6.900,00, R$ 1.900,00, "6 × R$ 1.150,00" e a linha 14/12/2026 com
  833,33, 316,67 e 1.150,00.
- A3: entrada inválida mostra um alerta em vez do resultado.
- A4: cobertura mínima de 85% do componente; typecheck e lint verdes.

## Cenários

- C1: render mostra os campos e o botão.
- C2: preencher o exemplo da RFC-004 §5 e clicar em "Simular" mostra o resumo.
- C3: no mesmo resultado, a tabela tem a linha da 1ª parcela.
- C4: valor "5000" e "Simular" mostra um elemento com role alert.
