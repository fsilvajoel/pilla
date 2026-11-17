# Exemplos de revisão de teste

## Aprovada

```
# Revisão E4-T03

revisor: reviewer <modelo> <id da geração>
arquivo: src/log/redact.test.ts b6571add2936f547d4a5af135aacd88ca6341558

- [x] every test fails now (the stub throws) and would pass with a correct implementation (run_check 0) — check mecânico (passou antes da revisão)
- [x] import { REDACTED, redact } from "./redact"; — line 2: import { REDACTED, redact } from "./redact"
- [x] each of the keys cpf, phone, email, password and token has its value replaced by REDACTED — lines 4-10, 19-25: describe.each(SENSITIVE_KEYS) covers cpf, phone, email, password, token
- [x] keys that end with a sensitive name are redacted too, ignoring case (accessToken, ownerCpf, userEmail, PASSWORD), and other keys keep their value (name, amountCents, id) — lines 10-14, 19-25 and lines 16, 27-33
- [x] nested objects and objects inside arrays are redacted at any depth — lines 35-41 (C4) and lines 43-48 (C5)
- [x] the input is not changed (structuredClone before the call, never a JSON round trip) — lines 51-57 (C6)
- [x] a Date, an Error, a string, a number and null are returned as they came (toBe) — lines 60-70 (C7)
- [x] never edit src/log/redact.ts — allowedPaths/protectedTests do harness
```

O que a torna boa:
- o primeiro item é o check mecânico;
- toda evidência cita linhas e o cenário;
- o sha fixa o arquivo revisado.

## Reprovada (padrões a recusar)

- `- [x] covers nested objects — yes` → sem linha; vira `[ ]`.
- `- [x] all tests fail now — reading the stub, it throws` → leitura não prova; rode o check.
- Um teste que compara com `JSON.parse(JSON.stringify(x))` quando o `done` pede `structuredClone` → `[ ]`, cite a linha.
- Teste que já passa contra o esboço → reprovação imediata no passo 1.
