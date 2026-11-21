# E13-F03C: web, bloco de pagamentos pendentes em /alertas

Plano da feature. Cartão: E13-T12 (tela, claude): leva `shadcn` e `tailwind-css`. Referências: PRD-001 RF-50, `docs/plano/E13-F02B/plano.md`, `docs/plano/E13.md` D2 e D8, `docs/plano/E11.md`. Sem teste automatizado nesta fase; revisão visual e cobertura pelo E2E (F04B).

## Dependência
Depende da F02B (bloco preenchido) e da F03B (a tela). Espera a E11-T04 pela cadeia da F02B.

## Escopo

Entra:
- Bloco "Pagamentos pendentes de conferência" em `/alertas`, depois de "Atrasadas", com contagem e total no título.
- Linha: pessoa, contrato (link para `/emprestimos/{loanId}`), valor, data do pagamento, forma (Pix, boleto, dinheiro, transferência, em português) e data do registro; mais antigo primeiro.
- Selo "Contrato em rascunho" quando `loanStatus` é DRAFT.
- Estado vazio "Nenhum pagamento aguardando conferência.".

Fora: confirmar ou estornar na própria tela (ficam nas telas da E11-F05; este bloco só leva ao contrato). Se a E11-F05 definir uma rota da fila de conferência, o título do bloco passa a linkar para ela (ajuste de uma linha, sem decisão nova).

## Critérios de aceite
- Com um pagamento PENDING_REVIEW, o bloco o mostra com valor e link.
- Sem pendentes, mostra o estado vazio.
- Contrato DRAFT mostra o selo.
- Sem erro no console. Typecheck e lint passam.
