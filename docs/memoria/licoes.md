# Lições

| ID | Data | Lição | Origem |
|---|---|---|---|
| LI-001 | 2026-11-14 | A verificação do harness compara `git status` com `allowedPaths`; arquivos gerados (`__pycache__`, `.pyc`, `dist`, `coverage`…) davam falso "fora do escopo". Filtro `GENERATED` + `PYTHONDONTWRITEBYTECODE=1` nos checks. | TOY-T01 |
| LI-002 | 2026-11-14 | Pedir à Alice resumo de arquivo grande (> ~3 mil palavras) numa chamada direta pode voltar vazio. Mandar por trechos ou usar `read_rule`/leitura por linhas. | auditoria |
| LI-003 | 2026-11-14 | A Alice gera muito texto de raciocínio (~35 mil tokens para 3 linhas de código). Custa tempo de GPU, não tokens do Claude; medir com `metrics` antes de cortar. | auditoria |
| LI-004 | 2026-11-14 | Cartão com arquivo inteiro em `readFirst` gasta contexto; prefira `rules: [IDs]` (o harness injeta só as definições). | auditoria |
| LI-005 | 2026-11-14 | A varredura de marcadores proibidos acusava o próprio arquivo de política (que guarda os padrões como dado). Arquivos `policy*.yaml` ficam fora da varredura. | H-02 |
| LI-006 | 2026-11-14 | `think: false` cortou a saída da Alice de ~35 mil para ~2,3 mil tokens na mesma tarefa (TOY-T01: 48 mil → 33 mil no total, 21 s), sem perder qualidade. Padrão agora é `false`. | TOY-T01 v2 |
| LI-007 | 2026-11-14 | O custo de entrada da Alice cresce com o histórico: cada chamada reenvia tudo (H-01: 23 chamadas = 762 mil tokens de entrada). Cartão pequeno e regra injetada reduzem chamadas; compactação mais cedo é item da V2. | H-01, H-02 |
| LI-008 | 2026-11-14 | Teste de regex precisa de casos que distinguem o padrão certo de um parecido: a Alice corrompeu a regex do TODO e o teste passou por coincidência. | H-02 |
