# E15-F05A: web, entrada por CPF e lista de contratos do portal

Plano da feature. Cartão: E15-T09 (Sonnet). Referências: PRD-001 RF-61, RF-64, RN-A04, ADR-0011, ADR-0013, ADR-0017
(emenda de 19/11), `docs/plano/E15.md` D2, D3, D6, D12, D14, D15.

## Escopo

Entra:
- `apps/web/lib/portal-texts.ts` (novo, **fonte única** dos textos do portal, D12) e `apps/web/lib/portal-format.ts`
  (`formatReais`, `formatDate` dd/mm/aaaa, reaproveitando o que já existe em `lib/` se houver).
- `apps/web/lib/api/portal.ts`: `createPortalSession`, `deletePortalSession`, `getPortalLoans`, `getPortalLoan`,
  respostas lidas com os schemas da F01; repassa o cookie `pilla_portal` (D15).
- Rotas em `apps/web/app/(portal)/portal/`: layout próprio (sem navegação do ADMIN, cabeçalho simples com o nome do
  sistema e o botão "Sair" só quando logado), `page.tsx` (CPF), `contratos/page.tsx` (lista), `actions.ts` (entrar,
  sair), `loading.tsx` e `error.tsx`. `dynamic = "force-dynamic"`.

Fora: detalhe (F05B); teste de tela (D14); lembrar o CPF no navegador (nada de `localStorage`, nem `autocomplete`
de CPF salvo: `autocomplete="off"`); qualquer dado da pessoa.

## Textos (RF-64), exatamente estes

| Onde | Texto |
|---|---|
| Título da entrada | "Acompanhe seus empréstimos" |
| Instrução | "Digite o seu CPF para ver a situação dos seus contratos." |
| Campo | rótulo "CPF", ajuda "Só números, 11 dígitos." (aceita colar com pontos e traço: a tela tira a pontuação antes de enviar) |
| Botão | "Ver meus contratos" |
| Erro de CPF inválido (cliente) | "Esse CPF não parece certo. Confira os 11 números." |
| Erro 401 | "Não foi possível entrar com este CPF. Se você acha que deveria ter acesso, fale com quem fez o seu empréstimo." |
| Erro 429 | "Muitas tentativas. Espere um minuto e tente de novo." |
| Outro erro | "Algo deu errado. Tente de novo em instantes." |
| Sessão vencida | "Por segurança, entre de novo com o seu CPF." |
| Título da lista | "Seus contratos" |
| Situação | "Em dia", "Em atraso", "Quitado" |
| Cartão do contrato | "Contrato 2026-0012", "Emprestado: R$ 5.000,00", "Falta pagar: R$ 4.600,00", "Próxima parcela em 14/02/2027" (quitado: "Contrato quitado. Nada a pagar.") |
| Lista vazia | "Não encontramos contratos para este CPF." |
| Botão do cartão | "Ver detalhes" |
| Sair | "Sair" |

## Critérios de aceite

- A1: `/portal` mostra o formulário, sem navegação do ADMIN; enviar CPF válido de pessoa habilitada leva a
  `/portal/contratos`; a Server Action grava o cookie com `httpOnly`, `secure` (fora de dev), `sameSite lax`.
- A2: 401, 429 e erro inesperado mostram os textos da tabela; o 401 não diz se o CPF existe.
- A3: `/portal/contratos` mostra um cartão por contrato com situação (cor e texto, nunca só cor), valores em reais
  e a próxima parcela; clicar em "Ver detalhes" vai a `/portal/contratos/{id}`; lista vazia mostra a frase da tabela.
- A4: sem cookie ou com 401 da API, `/portal/contratos` volta a `/portal` com a frase "Sessão vencida".
- A5: "Sair" chama `DELETE /portal/session`, apaga o cookie e volta a `/portal`.
- A6: o CPF digitado nunca aparece na URL, no título nem em mensagem de erro; a página não é cacheada.
- A7: nenhum texto do portal fora de `portal-texts.ts`; nenhuma sigla (CPF é a única, e o cliente a conhece); acessível
  (campo com rótulo, foco visível, contraste, lê no celular em 360 px de largura).
- A8: revisão visual no navegador: entrada, erro, lista com ACTIVE em dia, em atraso e quitado, lista vazia; sem erro
  no console.

## Dependências

F02, F04, E9-T13 (shared), cliente HTTP da E9. Destrava F05B e F07A.
