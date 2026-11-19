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
