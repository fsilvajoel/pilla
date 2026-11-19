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

Nenhuma.
