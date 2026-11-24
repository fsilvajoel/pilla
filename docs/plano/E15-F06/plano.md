# E15-F06: web ADMIN, chave "Acesso ao portal" na ficha da pessoa (depende da E14)

Plano da feature. Cartão: E15-T11 (Haiku). Referências: PRD-001 RF-60, ADR-0013, `docs/plano/E15.md` D13, D14,
`docs/plano/E15-F03/plano.md`.

**Dependência explícita da E14:** a tela é do ADMIN logado; chama endpoints da F03, que exigem o login da E14.

## Escopo

Entra: um cartão "Acesso ao portal do cliente" na ficha da pessoa (`apps/web/app/(admin)/pessoas/[id]`), com uma chave
(`Switch` do shadcn) e a Server Action que chama `PUT /portal-access/{personId}`; leitura do estado por
`GET /portal-access/{personId}` (`apps/web/lib/api/portal-access.ts`, novo).

Fora: lista de pessoas com acesso; histórico; enviar o link ao cliente.

## Critérios de aceite

- A1: a ficha mostra o cartão com o estado atual ("Acesso liberado desde dd/mm/aaaa" ou "Acesso não liberado") e a chave.
- A2: ligar chama `PUT {enabled: true}`, mostra "Acesso liberado." e atualiza o estado; desligar mostra "Acesso
  desligado. O cliente sai do portal na hora."; erro da API aparece pelo componente de erro compartilhado.
- A3: pessoa sem CPF: a chave fica desligada e desabilitada com o texto "Cadastre o CPF para liberar o acesso." (e o 422
  `PERSON_WITHOUT_CPF` da API, se vier, mostra a mesma frase).
- A4: um texto curto explica: "O cliente entra só com o CPF e só consegue ver os contratos dele."
- A5: revisão visual: ligar, desligar, sem CPF, erro; sem erro no console.

## Dependências

F03, **E14**, ficha da pessoa (E5/E9), E9-T13. Destrava F07B.
