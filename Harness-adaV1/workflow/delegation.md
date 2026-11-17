# Workflow: delegation

## Objetivo
Escalar ao papel platform só quando a tarefa sai do escopo do papel atual ou a validação local provou um problema
estrutural.

## Participantes
| Papel | Função aqui |
|---|---|
| coordinator | decide se delega e revisa o resultado |
| platform | corrige o problema estrutural |

## Etapas
1. Definir a tarefa e os critérios de aceite exatos.
2. Rodar a validação local e guardar a evidência ([auto-validation](../policy/auto-validation.md)).
3. Classificar a falha: local, transversal ou estrutural.
4. Falha local: corrigir e validar de novo.
5. Falha estrutural persistente: delegar com passagem estreita (`script/validate_then_delegate.py`).
6. Entregar à platform a evidência, o escopo e o risco restante.
7. Revisar o resultado delegado contra o objetivo original.

## Regra de delegação
Delegar só quando:
- a validação local falhou ou é impossível no escopo atual;
- o problema atravessa camadas, arquitetura ou plataforma;
- a passagem continua estreita e rastreável.

## Pronto quando
- [ ] Os checks originais passam com o resultado delegado.
- [ ] A falha estrutural tem teste ou gate que a pega.
- [ ] A saída final continua alinhada ao objetivo original.
