T23 defeitos plantados:
D1 C3 allocation-preview.ts amountCents z.int().positive() (deveria positiveCentsSchema)
D2 C5 index.ts sem export de reverse-payment
D3 C7 attachment-upload-url.ts sizeBytes z.number().int() (check-avoid acusa)
D4 C4 portal-session.ts cpf z.string().regex (regex fora de common.ts; deveria cpfSchema)
Implement T15 portal-access, T19 payoff-quote, T22 attachment-upload-url: sem ESBOÇO, export type, strictObject, testes do cartão passando.
