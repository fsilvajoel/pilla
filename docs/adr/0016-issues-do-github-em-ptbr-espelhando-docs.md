# ADR-0016 — Issues do GitHub em pt-BR, espelhando os docs

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-19 |
| Origem | Decisão do Joel (19/11); amplia o `sync_github_project.py` do Ada; respeita a [ADR-0012](0012-idioma-codigo-ingles-docs-portugues.md) |

## Contexto
As issues geradas pelo Ada hoje são só status em inglês (etapa, progresso, bloqueio). O Joel acompanha o projeto pelo
GitHub e quer ali a **especificação do card** em português, com imagens (telas) quando houver. A fonte da verdade
continua nos `.md`/`.yaml` do repositório; a issue é uma vitrine derivada.

## Decisão
- Cada issue de feature (`<!-- ada-feature:<ID> -->`) e de defeito (`<!-- ada-defeito:<ID> -->`) é **gerada** dos
  docs, em pt-BR, e nunca editada à mão (o próximo sync sobrescreve).
- Conteúdo da issue de feature: resumo e objetivo; regras (RN/RF/CA) citadas pelo PRD; contrato (do `plano.md`);
  cartões com **DoR** e **DoD** (`done`, `checks`, `dependsOn`, `allowedPaths`); ADRs, RFCs e PRD referenciados
  (`refs`) com link; telas do PRD/feature; estado (etapa, progresso, bloqueio).
- Issue de defeito: vem de `docs/defeitos/D<n>.md` (reprodução, obtido × esperado, severidade, camada, correção,
  evidência) e do `revisao.md` da feature de origem; label `bug`.
- Imagens: arquivos `.png/.jpg/.svg` referenciados nos docs entram por link absoluto do repositório público
  (`https://github.com/fsilvajoel/pilla/blob/main/<caminho>?raw=true`), pois a API do `gh` não envia anexo.
- Texto em inglês dos cartões (título, `done`, `hints`) é **traduzido** para pt-BR; a tradução é cacheada em
  `docs/plano/<feature>/issue.pt-br.md` e só é refeita quando o hash da fonte muda.
- Quem faz o quê: um **renderizador determinístico** (sem IA) monta a estrutura e copia o que já está em pt-BR; a
  **Alice** só traduz os trechos em inglês e resume o que passar do limite de 65 mil caracteres; o orquestrador
  confere e roda o sync.
- Mantém o filtro de segredos do sync (IPs, caminhos de máquina, chaves, `.env`); achado = nada é enviado.

## Consequências
- O Joel lê a spec completa no celular, sem abrir o repositório.
- Duas passagens (renderizar → traduzir) tornam a tarefa pequena o bastante para a Alice (9b) executar com conferência.
- Custo: o sync precisa de `gh` autenticado e de revisão da tradução antes do `--apply`.
- Obrigatório: todo doc novo referenciado por card precisa de link relativo resolvível (o renderizador falha se não).

## Alternativas consideradas
- Alice escrevendo a issue inteira — não: alucina estrutura e foge da fonte; só traduz.
- Traduzir os cartões para pt-BR na origem — não: a ADR-0012 mantém cartões em inglês (vão para o código/IA).
- Editar issues à mão — não: diverge dos docs.
