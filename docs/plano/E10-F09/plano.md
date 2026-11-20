# E10-F09: web, telas de renovar, renegociar, baixar e cotação de quitação

Plano da feature. Cartão: E10-T17 (claude), cartão de tela, com `shadcn` e `tailwind-css`. Referências: PRD-001 RF-13 a RF-16, `docs/plano/E10.md` D3, D8 e D12, RN-C08, RN-C14, RN-C17, RN-C19. Sem teste automatizado; a revisão é visual.

## Escopo

Entra:
- Rotas `/emprestimos/[id]/renovar`, `/renegociar`, `/baixa` e `/quitacao`, e os links no detalhe só para contratos ACTIVE.
- Renovar e renegociar:
  - antes de confirmar, mostram o novo principal (e a parte capitalizada);
  - depois, levam ao novo DRAFT;
  - `RENEWAL_REQUIRES_INTEREST_PAID` aparece em pt-BR ao lado do botão.
- Baixa: motivo obrigatório.
- Quitação: data (padrão hoje) e o total com os três componentes. A tela informa que a quitação é feita registrando um pagamento (E11).

Fora: registrar o pagamento de quitação (E11).

## Critérios de aceite
- Os links só aparecem em contrato ACTIVE.
- Todas as rotas abrem.
- Os erros aparecem em pt-BR.
- Não há erro no console.
- Typecheck e lint passam.
