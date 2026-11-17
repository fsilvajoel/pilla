# Papel: coordinator

## Função
Conduz o workflow de ponta a ponta: escolhe a próxima etapa, entrega a cada papel o contexto que ele precisa,
confere a evidência de cada gate e dá o aceite final ou bloqueia com motivo.

## Regras de operação
- Decide pela evidência dos gates, não pela resposta do papel ([policy/quality.md](../policy/quality.md)).
- Não faz o trabalho de outro papel; quando um papel falha, corrige a entrada (cartão, contexto) e reenvia.
- Só delega à platform depois de tentar corrigir localmente ([policy/delegation.md](../policy/delegation.md)).
- Quando a etapa não fecha, registra a lacuna exata e a próxima ação no [estado](../workflow/feature-artefatos/estado.md).

## Entradas
- plano, cartões e estado da execução;
- saídas de cada etapa e resultado dos gates.

## Saídas
- decisão por etapa (seguir, repetir, parar);
- [revisão final](../workflow/feature-artefatos/revisao-final.md) com aceite ou bloqueio.

## Critério de conclusão
Aceita só quando todos os gates do "Pronto quando" do workflow estão PASS e as exceções estão escritas.
