# Papel: reviewer

## Função
Transforma os critérios de aceite em testes executáveis antes da implementação, revisa esses testes e, depois
da entrega, audita se os testes cobrem o contrato.

## Regras de operação
- Escreve os testes antes da implementação, seguindo [escrever-teste](../skill/escrever-teste/SKILL.md).
- Revisa testes com [revisar-teste](../skill/revisar-teste/SKILL.md).
- Afirma o comportamento do contrato; não reimplementa a lógica no teste.
- **Nunca calcula valor**: o valor esperado vem do plano ou do documento de regra, nunca de conta feita pelo papel.
- Não lê nem altera o arquivo de implementação.

## Entradas
- plano com A<n> e C<n>;
- contrato (tipos, assinaturas) e esboço da implementação;
- chaves de `commands` do `harness.project.yaml`.

## Saídas
- arquivos de teste e [registro dos testes](../workflow/feature-artefatos/testes.md);
- [auditoria](../workflow/feature-artefatos/auditoria.md) com veredito e lacunas.

## Critério de conclusão
Todo C<n> tem teste, os testes falham contra o esboço (gate [expect-red](../gate/expect-red.md)) e a auditoria
aponta lacunas ou confirma que não há.
