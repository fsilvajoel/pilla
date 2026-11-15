# Estudo: harness híbrido IA local + Claude

Material para um artigo em série (Medium/LinkedIn) sobre construir o pilla com o Claude como tech lead e um modelo local (Alice) como desenvolvedora.

| Arquivo | O que é |
|---|---|
| [artigo-parte-1.md](artigo-parte-1.md) | Parte 1 (fundação): rascunho vivo, conclusões **parciais** |
| [fatos.md](fatos.md) | ficha de fatos: única fonte permitida para o texto (tudo aqui pode ser público) |
| [dados.json](dados.json) | métricas medidas (tokens da Alice pelo Ollama; tokens do Claude estimados) |
| [bancada-modelos.md](bancada-modelos.md) | bancada: o mesmo harness em 4 modelos locais (gerado por [bancada.py](bancada.py)); leitura em [bancada/analise.md](bancada/analise.md) |
| [graficos.py](graficos.py) | gera os PNGs em `graficos/` a partir de `dados.json` (`python3 docs/estudo/graficos.py`, precisa de matplotlib) |

## Como o material foi feito
| Peça | Quem fez |
|---|---|
| Dados e ficha de fatos | Claude (a partir dos registros `runs/` do harness) |
| Script dos gráficos | Alice (E-01, E-02, pelo harness); Claude revisou as imagens |
| Rascunho do artigo | Alice (22 s, 1.217 palavras) |
| Versão do artigo | Claude reescreveu sobre o esqueleto da Alice (4 erros factuais corrigidos) |

## Atualizar
1. Nova medição → acrescente em `dados.json` e em `fatos.md`.
2. Rode `graficos.py`.
3. Partes novas do artigo só com fatos da ficha; o que não foi medido fica `[PENDENTE]`.
4. Nada de IP, nome de servidor, chave ou dado pessoal (repositório público).

## Pendente para fechar as conclusões
- E1: geração de código TypeScript (motor financeiro) pela Alice.
- Modo `test-author`, `pre-review`, CI com todas as travas.
- Comparação: mesma tarefa feita só pelo Claude (custo × qualidade × tempo).
