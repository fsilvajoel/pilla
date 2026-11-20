# Refinamento funcional E9-F06

refinador: refiner
rodada: 2

## Requisitos
- [x] Todo `A<n>` é observável e está no molde fixo (entrada, domínio, saída, erro, fonte, camada).
- [x] Toda regra tem fonte; toda entrada externa tem linha na tabela de domínio, com rejeição e erro exato.
- [x] Contrato, arquivos de produção, dependências e arquivos de teste previstos bastam para escrever os testes e
      implementar sem adivinhar. `sonner` e `next-themes` aprovados em 19/11 (travas §7).

## Cartões
| Cartão | DoR | DoD |
|---|---|---|
| E9-T11 | ajustado | ajustado |
| E9-T12 | ajustado | ajustado |
| E9-T13 | ajustado | ajustado |

## Veredito
ajustado

## Mudanças
- plano.md (A5): prop `destructive` do contrato ganhou saída observável (`data-variant` do botão de confirmar) e o cenário C20 em `confirm-dialog.test.tsx` (fonte: contrato/esboço `ConfirmDialogProps`; cobertura de 100% por arquivo).
- plano.md (A4): propriedade sem ambiguidade: N > 0 dá N `row` no corpo; 0 dá exatamente 1 `row`, a de vazio (fonte: D6, T12 done "empty").
- plano.md (A7): regra do link ativo explícita (`pathname === href` ou prefixo `href + "/"`) e marca "pilla" na saída e no C16 (fonte: exemplos do A7; contrato do `AdminShell`).
- plano.md (Paleta, Riscos, Tipo dos cartões): valores da tabela são os aprovados, sem ajuste de matiz (Decisões 2 e 3); "ver Pendências" virou "ver Decisões, 1"; risco das dependências novas aponta para a pendência; skills do T12 alinhadas.
- E9.yaml (E9-T11): skills da tabela de tela (`react-best-practices` entra, `editar-arquivo` sai); refs e `readFirst` com o plano; `apps/web/hooks/**` (alias `hooks` do `components.json`, hook `use-mobile` da sidebar) e o plano (registro da troca `form`→`field`) no `allowedPaths`; checks `check-allowed-deps` e ausência de `.dark`; done com os tokens exatos da Paleta, AA manual pelo reviewer, comentário no `badge.tsx` (fonte: plano, Paleta, Riscos e Decisões 1 a 3; D5; D6).
- E9.yaml (E9-T12): skills `accessibility`, `shadcn`, `react-best-practices` (sai `escrever-teste`, do papel); refs e `readFirst` com plano, esboço, `ui/` gerado e config do vitest; done com um item por arquivo de teste e C1 a C20, incluindo `admin-shell.test.tsx` (A7) com stub de `matchMedia` e mock de `next/navigation` (fonte: plano, Cenários e Riscos).
- E9.yaml (E9-T13): skills sem `coding-guidelines` (do papel); refs e `readFirst`; checks `build` e grep contra `style=` e cor literal em `shared/`; done com cobertura de 100% por arquivo, `Toaster` `theme="light"`, `AdminShell`/`AdminNav` em `shared/` e layout só compondo, sem esboço restante (fonte: D5, D6, Decisão 4, Riscos).

## Pendências de PM
- Nenhuma. Os ids `<id>-error`/`<id>-description` e a regra do link ativo foram aprovados em 19/11 (`pendencias-pm.md`).

## Rodada 2 (19/11)
- resolvidas: `sonner` e `next-themes` aprovados (E9-T11 e `docs/travas.md`); T11 em `ajustado`.
- ressalvas aplicadas: `ConfirmDialog` marcado como cliente (`"use client"`, no plano e no esboço); aria-label do sonner depende da versão, conferido no T11; `data-variant` só confere depois do T11; ids `-error`/`-description` e regra do link ativo marcados como proposta, com pergunta ao PM (Decisões, 5).
- segunda opinião do pepe (nemotron-3.5-lightning:free) sobre esta feature: não rodada ainda.
