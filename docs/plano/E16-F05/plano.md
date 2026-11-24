# E16-F05: cliente web e tela `/importacao`

Plano da feature. Cartões: E16-T09 (cliente, haiku) e E16-T10 (tela, sonnet). Referências: PRD-001 RF-70, `docs/plano/E16.md` D9 e D11. Telas sem teste unitário nesta fase (emenda da ADR-0017); a cobertura é o E2E (F06).

## Escopo

Entra:
- `apps/web/lib/api/imports.ts`: `uploadSpreadsheet(file)` (`POST /imports/spreadsheet`, `text/csv`) e `getImport(id)`, tipados com `@pilla/schemas`; 409 `IMPORT_ALREADY_DONE` devolvido como resultado tipado com o id do lote existente.
- `apps/web/app/(admin)/importacao/`: seletor de `.csv`, lista das colunas esperadas (D3), aviso de que reenviar arquivo alterado cria os registros de novo, resumo dos totais, tabela "a revisar" (REVIEW e REJECTED) com número da linha, motivos em pt-BR (`apps/web/lib/labels.ts`) e links para contrato e pessoa; estados de carregamento, vazio e erro; item "Importação" no menu admin.

Fora: corrigir linha na tela; histórico de importações (só o relatório da última e `GET` por id); exportar relatório.

## Critérios de aceite

- A1: o seletor só aceita `.csv` e mostra as colunas esperadas.
- A2: após o envio aparecem os totais e a tabela com linha, motivos em português e links para contrato e pessoa.
- A3: 409 mostra mensagem com link para o relatório já existente.
- A4: erro 422 mostra o motivo; há estado de carregando e de lista vazia ("nada a revisar").
- A5: `pnpm --filter @pilla/web typecheck`, `lint` e `test` passam; sem `any`.

## Dependências

F04. Destrava F06.
