# Pendências de PM

Fila única do refinamento funcional (`pm_queue` do `harness.project.yaml`; workflow feature do harness, etapa
1b). O `refiner` abre uma entrada por pergunta de produto que os docs aprovados não respondem; a feature fica
`needs_input` enquanto houver entrada `aberta` dela. O Joel (PM) responde em `resposta`; o refiner aplica na
rodada 2 e marca `resolvida`.

Formato de cada entrada:

```md
## <ID do cartão> (<ID da feature>)
- status: aberta | resolvida
- data: AAAA-MM-DD
- pergunta: <decisão de produto que falta>
- opções: a) ...; b) ...
- sugestão padrão: <opção e por quê>
- resposta: <preenchida pelo PM>
```

## Entradas

## E5-T06 (E5-F02)
- status: resolvida
- data: 2026-11-19
- pergunta: no cadastro de pessoa (caso de uso `createPerson`, fora da E5-F02), qual `code` e HTTP devolver quando o CPF já existe? O catálogo da RFC-004 §6 não tem código para isso. A E5-F02 deixa o erro do banco subir sem tradução (não bloqueia).
- opções: a) 409 com `code` `DUPLICATE_CPF`, detalhe "CPF já cadastrado."; b) 422 com `DUPLICATE_CPF` (como `DUPLICATE_PIX_TRANSACTION`)
- sugestão padrão: a) 409 `DUPLICATE_CPF`, é conflito de recurso e mantém o código estável em inglês (RFC-004 §6)
- resposta: a) 409 `DUPLICATE_CPF`, detalhe "CPF já cadastrado."

## E5-T06 (E5-F02)
- status: resolvida
- data: 2026-11-19
- pergunta: no `createPerson`, o que devolver quando `referredById` aponta para pessoa que não existe (RN-P02: indicador é pessoa cadastrada)? A E5-F02 deixa o erro de FK do banco subir (não bloqueia).
- opções: a) 422 com `code` `REFERRER_NOT_FOUND`, detalhe "Indicador não encontrado."; b) 404 `NOT_FOUND` (código genérico já existente na RFC-004 §6)
- sugestão padrão: a) 422 `REFERRER_NOT_FOUND`, porque o 404 diria que a própria rota não existe
- resposta: b) 404 `NOT_FOUND` genérico

## E5-T06 (E5-F02)
- status: resolvida
- data: 2026-11-19
- pergunta: no cadastro novo, o CPF é obrigatório? RN-P01 diz que só registro importado pode ficar sem CPF, mas o `createPersonRequest` da decisão de 17/11 já lista `cpf` como obrigatório e o repositório aceita nulo (importação). Confirmar que a API de cadastro sempre exige CPF válido.
- opções: a) CPF obrigatório e válido (dígito verificador) no cadastro; nulo só na importação; b) CPF opcional também no cadastro
- sugestão padrão: a) obrigatório, igual a RN-P01 e à decisão de 17/11
- resposta: a) CPF obrigatório e válido (dígito verificador) no cadastro; nulo só na importação

## E5-T11 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: quais campos o `PATCH /people/{id}` edita? RF-01 lista nome, CPF, telefone, e-mail, nascimento e observações; o indicador (`referredById`) não aparece. A E5-F05 implementa só esses seis no `updatePerson` (não bloqueia).
- opções: a) só os seis de RF-01; indicador fica fixo após o cadastro; b) os seis mais `referredById` (com 404 `NOT_FOUND` se não existir e erro de autorreferência)
- sugestão padrão: a) só os seis de RF-01
- resposta: a) só os seis de RF-01
- aplicada como dependência de implementação separada

## E5-T11 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: na edição, enviar `null` limpa um campo opcional? Em especial o CPF: RN-P01 só admite CPF vazio em registro importado. O `updatePerson` aceita o que o banco aceita (não bloqueia).
- opções: a) `null` limpa e-mail, nascimento e observações; CPF não pode ser limpo na edição; b) `null` limpa qualquer campo opcional, CPF incluído; c) `null` não limpa nada (campo ausente e `null` têm o mesmo efeito)
- sugestão padrão: a) limpa os opcionais, menos o CPF (RN-P01)
- resposta: a) limpa os opcionais, menos o CPF (RN-P01)
- aplicada como dependência de implementação separada

## E5-T13 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: qual `code` e HTTP a borda devolve quando a pessoa é indicada por ela mesma (`persons_referred_by_id_check`, RN-P02)? O catálogo da RFC-004 §6 não trata disso. Até a resposta, `personWriteErrorCode` devolve `null` (não bloqueia).
- opções: a) 400 `VALIDATION_FAILED` (o Zod da borda barra antes do banco); b) 422 com código próprio, ex. `SELF_REFERRAL`
- sugestão padrão: a) 400 `VALIDATION_FAILED`, é entrada inválida e o código já existe
- resposta: sem código na API por enquanto; revisar se a edição passar a aceitar `referredById`

## E5-T15 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: como funciona o `search` de `GET /people` (RF-04: nome ou CPF)? Bloqueia E5-T15/E5-T16.
- opções: a) nome por trecho, sem distinguir maiúsculas; CPF por prefixo dos dígitos, ignorando ponto e traço; b) a), e o nome também ignora acentos (exige `unaccent`, extensão nova); c) nome por início da palavra; CPF só exato
- sugestão padrão: a) trecho no nome sem caixa (índice `lower(full_name)` da RFC-005 §3) e prefixo no CPF
- resposta: a) trecho no nome sem caixa (índice `lower(full_name)` da RFC-005 §3) e prefixo no CPF
- aplicada como dependência de implementação separada

## E5-T15 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: qual a ordem da lista de pessoas? O cursor depende dela. Bloqueia E5-T15/E5-T16.
- opções: a) nome (`lower(full_name)`) e, no empate, `id`; b) mais recentes primeiro (`created_at` desc, `id`)
- sugestão padrão: a) por nome com desempate por id
- resposta: a) por nome com desempate por id
- aplicada como dependência de implementação separada

## E5-T15 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: qual o `limit` padrão e o máximo da lista de pessoas, e o que fazer com valor fora da faixa? A RFC-004 §2 mostra `limit=50` só como exemplo. Bloqueia E5-T15/E5-T16.
- opções: a) padrão 50, máximo 100, fora de 1..100 dá 400 `VALIDATION_FAILED`; b) padrão 50, máximo 100, valor acima é reduzido a 100 sem erro
- sugestão padrão: a) 50/100 com 400 fora da faixa; o cursor é opaco (base64 do último nome e id)
- resposta: padrão 20 (decisão do Joel, 19/11, no lugar do 50 sugerido), máximo 100, fora de 1..100 dá 400 `VALIDATION_FAILED`; o cursor é opaco (base64 do último nome e id)
- aplicada como dependência de implementação separada

## E5-T15 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: a lista de pessoas traz as inativas? Bloqueia E5-T15/E5-T16.
- opções: a) traz todas; o `active` do resumo mostra a situação; b) só ativas por padrão, com filtro `?active=` para ver as outras; c) só ativas, sem filtro
- sugestão padrão: b) só ativas por padrão, com filtro opcional
- resposta: b) só ativas por padrão, com filtro opcional
- aplicada como dependência de implementação separada

## E5-T15 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: no `personSummary`, pessoa importada sem CPF (RN-P01) vem com `cpf: null` ou sem o campo? A infra devolve `null` (não bloqueia).
- opções: a) `cpf: null`; b) campo omitido
- sugestão padrão: a) `cpf: null`, forma fixa para o front
- resposta: a) `cpf: null`, forma fixa para o front
- aplicada como dependência de implementação separada

## E5-T15 (E5-F05)
- status: resolvida
- data: 2026-11-19
- pergunta: cursor malformado na listagem (base64 inválido, JSON inválido ou forma errada): erro na infra, tratar como sem cursor ou resolver na borda? Q2 da revisão.
- opções: a) erro na infra; b) tratar como sem cursor; c) borda HTTP
- sugestão padrão: a) erro na infra com cenário novo no T15
- resposta: a) erro na infra com `Error("invalid cursor")`; a borda HTTP traduz para 400 `VALIDATION_FAILED` depois
- aplicada no critério A17 e no cenário C19 (cartões E5-T15 e E5-T16)

## E9-T11 (E9-F06)
- status: resolvida
- data: 2026-11-19
- pergunta: `sonner` (Toaster, já previsto no plano e no T13 done) e `next-themes` (puxado pela CLI no componente `sonner`) não estão em "Dependências permitidas" de `docs/travas.md` §7, e o `check-allowed-deps` recusa. Aprova as duas no runtime web?
- opções: a) aprovar `sonner` e `next-themes`, e o T11 acrescenta as duas à lista da `docs/travas.md` (entra no `allowedPaths`); b) aprovar só `sonner` (Toaster com `theme="light"` fixo, sem `next-themes`, editando o `sonner.tsx` gerado como variante planejada); c) não usar Toaster no MVP (tira `sonner` da lista do T11 e do done do T13)
- sugestão padrão: a) é o caminho padrão da CLI do shadcn, sem editar arquivo gerado; as duas são pequenas e mantidas
- resposta: a) aprovadas `sonner` e `next-themes`; `docs/travas.md` §7 e o T11 atualizados (19/11)

## E9-F06 (ids e link ativo)
- status: resolvida
- data: 2026-11-19
- pergunta: aprova os ids `<id>-error` e `<id>-description` do `FormField` (para `aria-describedby`), e a regra do link ativo do `AdminNav` (`pathname === href` ou prefixo `href + "/"`)? Não vêm de decisão nem de RFC; são proposta do planner, ressalva da revisão.
- opções: a) aprovar como estão; b) outro padrão de ids ou de link ativo (dizer qual)
- sugestão padrão: a) são o padrão usual de acessibilidade e de navegação de seção
- resposta: a) aprovados os ids `<id>-error` e `<id>-description` e a regra do link ativo (19/11)

## E9-T03 (E9-F02)
- status: resolvida
- data: 2026-11-19
- pergunta: P1: qual `code` para o erro 500? A RFC-004 §6 não tem; `problemSchema` só aceita `code` que mapeie o `status`.
- opções: a) `INTERNAL_ERROR`, status 500; b) outro nome (ex. `INTERNAL_SERVER_ERROR`)
- sugestão padrão: a) `INTERNAL_ERROR`, como o D8 fez com `DUPLICATE_CPF`
- resposta: a) `INTERNAL_ERROR` com status 500; RFC-004 §6 editada, `errorCodeSchema` e `errorStatus` no E9-T03 (19/11)

## E9-T02 (E9-F02)
- status: resolvida
- data: 2026-11-19
- pergunta: P2: aprova `reflect-metadata`, `rxjs`, `supertest` e `@types/supertest` em `docs/travas.md` §7?
- opções: a) aprovar as quatro (`supertest` e `@types/supertest` em dev); b) recusar alguma
- sugestão padrão: a) aprovar as quatro
- resposta: a) aprovadas as quatro; `docs/travas.md` §7 atualizada (19/11)

## E9-T05 (E9-F03)
- status: resolvida
- data: 2026-11-19
- pergunta: a busca de pessoas por nome ignora acentos?
- opções: a) sim (exige tratar acentos na consulta); b) não, só caixa
- sugestão padrão: b) só caixa (menor)
- resposta: a) a busca ignora acentos, por ora ("jose" encontra "José"); aplicada nos cartões E9-T04 e E9-T05 (19/11)

## E10-T09 (E10-F05)
- status: resolvida
- data: 2026-11-20
- pergunta: a mora incide sobre o valor original da parcela ou só sobre o saldo que restou depois de um pagamento parcial (RFC-002 §6)?
- opções: a) só sobre o saldo em aberto da parcela; b) sobre o valor original até a quitação da parcela
- sugestão padrão: a) sobre o saldo em aberto
- resposta: a) sobre o saldo em aberto da parcela (aprovado pelo Joel em 20/11)
## E10-T09 (E10-F05)
- status: resolvida
- data: 2026-11-20
- pergunta: durante a carência, a parcela vencida aparece como OVERDUE (status da parcela) ou só depois que a carência acaba? O standing do contrato já usa a carência.
- opções: a) OVERDUE logo após o vencimento, com a carência só isentando os encargos; b) OVERDUE só depois da carência
- sugestão padrão: a) OVERDUE após o vencimento; standing e encargos respeitam a carência
- resposta: a) OVERDUE logo após o vencimento; a carência só isenta encargos (aprovado pelo Joel em 20/11)
## E10-T04 (E10-F02)
- status: resolvida
- data: 2026-11-20
- pergunta: PEND-01: no MVP, existe uma única conta base ("Conta principal") criada pelo seed, ou já há mais contas desde o início?
- opções: a) uma conta base com id fixo no seed; b) várias contas cadastradas pelo ADMIN (exige criar a tela de contas na E12)
- sugestão padrão: a) uma conta base
- resposta: a) uma conta base com id fixo no seed (aprovado pelo Joel em 20/11)
## E11 (esqueleto)
- status: resolvida
- data: 2026-11-20
- pergunta: as decisões de 19/11 §5 citam pagamento em contrato DRAFT, mas DRAFT não tem cronograma. Como alocar?
- opções: a) proibir pagamento em DRAFT (409 `LOAN_NOT_EDITABLE`); b) aceitar e deixar PENDING_REVIEW até a ativação, alocando na confirmação
- sugestão padrão: a) proibir
- resposta: b) aceitar: pagamento em DRAFT fica PENDING_REVIEW até a ativação e aloca na confirmação (Joel em 20/11)
## E12 (esqueleto)
- status: resolvida
- data: 2026-11-21
- pergunta: RN-C10: ao ativar um contrato com valor maior que o caixa da conta, o sistema bloqueia ou pede confirmação? A E10 ativa sem checar (D6), porque o saldo só existe depois da E12.
- opções: a) bloquear com 422; b) avisar e exigir confirmação explícita
- sugestão padrão: b) avisar e pedir confirmação
- resposta: b) avisar, sem bloquear (aprovado pelo Joel em 21/11)

## E12 (esqueleto)
- status: resolvida
- data: 2026-11-20
- pergunta: o painel (RF-32) lê uma tabela materializada `loan_positions` (RFC-005) ou uma consulta pública de lending calculada na hora (ADR-0005)?
- opções: a) consulta pública calculada; b) `loan_positions` atualizada por eventos
- sugestão padrão: a) consulta pública, até haver volume que justifique
- resposta: a) consulta pública calculada na hora (Joel em 20/11)
## E13 (esqueleto)
- status: resolvida
- data: 2026-11-20
- pergunta: haverá uma rotina diária para emitir `InstallmentOverdue` (RFC-004 §7), ou o atraso só é calculado na leitura?
- opções: a) sem rotina no MVP, atraso só na leitura; b) job diário que grava o evento no outbox
- sugestão padrão: a) sem rotina no MVP
- resposta: a) sem rotina no MVP; atraso só na leitura (Joel em 20/11)
## E13 (esqueleto)
- status: resolvida
- data: 2026-11-20
- pergunta: PEND-04: qual o número padrão de dias de carência em `default_terms`?
- opções: a) 0 dias; b) 3 dias; c) outro valor
- sugestão padrão: b) 3 dias
- resposta: a) 0 dias de carência (Joel em 20/11)
## E13-F02A (E13-T03)
- status: aberta
- data: 2026-11-21
- pergunta: no painel de alertas (RF-50), o que é "vencendo na semana"? O PRD não define a janela.
- opções: a) os próximos 7 dias depois de hoje (hoje + 1 até hoje + 7), sem repetir o que vence hoje; b) o resto da semana civil (até domingo); c) 7 dias incluindo hoje
- sugestão padrão: a) hoje + 1 até hoje + 7: janela fixa, não muda conforme o dia da semana, e "vencendo hoje" fica separado
- resposta:

## E13-F01 (E13-T01)
- status: aberta
- data: 2026-11-21
- pergunta: o RF-40 não fixa limites para os parâmetros padrão. Quais tetos o `PUT /settings/default-terms` deve aceitar (protege de erro de digitação, ex.: multa de 1000%)?
- opções: a) multa, mora e taxa sugerida até 100% (10000 bps), carência até 365 dias, passo de arredondamento até R$ 1.000; b) outros tetos (informar); c) sem tetos
- sugestão padrão: a) tetos de sanidade, fáceis de afrouxar depois (só o schema e os casos C14 a C18 mudam)
- resposta:

## E11-T04 (E11-F02)
- status: aberta
- data: 2026-11-21
- pergunta: como o ADMIN descarta ou corrige um pagamento PENDING_REVIEW lançado por engano (valor, data ou contrato errados)? O PRD e a RFC-004 só têm registrar, confirmar e estornar; estornar exige CONFIRMED. Um pendente que nunca pode ser confirmado (por exemplo, valor acima do saldo) ficaria para sempre na fila de conferência (RF-50).
- opções: a) sem descarte no MVP: confirmar e depois estornar (gera lançamentos de entrada e de estorno na tesouraria, E12) e, se não puder confirmar, o pendente fica na fila; b) `POST /payments/{id}/reject {reason}` leva o pendente a um status novo REJECTED (mudança na RFC-004 §3 e no check de `payments.status` da RFC-005 §5), sem efeito algum e com auditoria; c) permitir editar o pendente
- sugestão padrão: b) rejeitar com motivo, é o menor desvio e mantém a regra de imutabilidade (ADR-0006); entraria como cartão novo da F04
- resposta:

## E11-T04 (E11-F02)
- status: aberta
- data: 2026-11-21
- pergunta: o catálogo de erros da RFC-004 §6 não tem código para: confirmar pagamento de contrato DRAFT (decisão de 20/11), confirmar ou recusar pagamento que não está PENDING_REVIEW, e estornar pagamento que não está CONFIRMED. Quais códigos e HTTP usar?
- opções: a) 409 `LOAN_NOT_ACTIVE`, 409 `PAYMENT_NOT_PENDING` e 409 `PAYMENT_NOT_CONFIRMED`, acrescentados à RFC-004 §6 pelo cartão E11-T04; b) reaproveitar 422 `LOAN_CLOSED_FOR_PAYMENTS` e 409 `VERSION_CONFLICT`, sem códigos novos
- sugestão padrão: a) três códigos novos, estáveis e específicos (mesmo caminho da pendência de `DUPLICATE_CPF`)
- resposta:

## E11-T12 (E11-F07)
- status: aberta
- data: 2026-11-21
- pergunta: como cobrar encargos de uma parcela depois de um pagamento parcial? A RFC-002 §3.5 diz "a multa já paga não é cobrada de novo; a mora corre sobre o novo em aberto a partir da data do pagamento (detalhe a validar nos testes)", mas `@pilla/finance` hoje recalcula multa e mora sobre o em aberto desde o vencimento, o que cobra a multa outra vez após cada parcial.
- opções: a) seguir a RFC-002 §3.5 (multa uma vez; mora corre sobre o novo em aberto desde o pagamento; encargos não pagos continuam devidos), com a feature E11-F07; b) manter o cálculo atual (encargos sempre sobre o em aberto da parcela na data), sem a F07
- sugestão padrão: a) é o que a RFC já diz e é o único que deixa "saldo antes menos pagamento" igual ao "saldo depois"
- resposta:
