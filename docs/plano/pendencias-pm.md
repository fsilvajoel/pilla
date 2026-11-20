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
