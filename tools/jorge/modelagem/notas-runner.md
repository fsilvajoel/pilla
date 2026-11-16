1. **Resolva a fronteira de autoridade antes da estreia.** O bloqueio de Claude e qualquer alteração em `scripts/guard_hook.py` exigem decisão de Joel; esse caminho não está liberado ao Jorge. A criação de `tools/jorge/` por Claude não deve virar exceção para ele editar o harness.

2. **Implemente uma máquina de estados externa ao modelo.** ANÁLISE permite apenas leitura e `submit_report`; APLICAÇÃO permite as ferramentas aprovadas e `finish`. Rejeite chamadas fora da fase, inclusive lotes que tentem submeter relatório e escrever imediatamente.

3. **Autorize caminhos após normalização real.** Bloqueie `..`, caminhos absolutos indevidos, symlinks, hardlinks e escapes do workspace. Aplique exclusões também a `search_code`, listagens e saídas: uma busca global não pode revelar `.env` ou logs proibidos. Defina precisamente quais arquivos `retro-*` são legíveis.

4. **Isole a execução.** Use worktree limpo, base SHA fixada, usuário sem segredos e sandbox sem rede. Testes executam Python modificado pelo próprio agente: restrição apenas em `write_file` não impede escrita indireta ou acesso indevido durante `run_tests`.

5. **Faça aprovação de travas ser um bloqueio real.** Marcação no relatório não basta. Registre aprovação autenticada de Joel para uma proposta/diff específico; invalide-a se a mudança relevante variar. Mudanças de orçamento ou segurança fora desse alcance devem impedir aplicação e commit.

6. **Dê contexto inicial compacto.** Envie escopo, retros selecionadas, base SHA, versão, mapa dos módulos, resultado da suíte de referência, autorizações e orçamento da execução. Não despeje logs ou todo o harness no primeiro pedido.

7. **Limite ferramentas e respostas.** Estabeleça limites configuráveis de chamadas, tempo, tokens, linhas retornadas e tamanho de arquivo; informe-os ao Jorge. Reserve capacidade para `finish` e relatório. Truncamento deve ser explícito e permitir paginação.

8. **Detecte laços.** Sugestão inicial: no máximo duas correções por evolução após falha; interrompa chamadas idênticas repetidas sem mudança de estado. Não reinicie automaticamente a conversa apagando o histórico de tentativas e consumo.

9. **Execute uma baseline antes da análise.** Suíte já vermelha bloqueia aplicação automática. Registre contagens e descoberta; não fixe “231” como verdade eterna. Zero testes, queda inexplicada de descoberta ou novos skips de regressões não devem contar como verde.

10. **Não confie só no exit code.** Preserve resumo, falhas, erros e skips; aplique timeout e limite de saída. A validação final deve verificar também escopo do diff, autorizações, integridade dos testes e ausência de alterações proibidas.

11. **Faça transação e rollback fora do agente.** Capture o diff antes de reverter; reverta apenas o worktree isolado da execução. Em falha final ou interrupção, preserve relatório e diff como “não aplicado”. Nunca use limpeza destrutiva num checkout com trabalho de Joel.

12. **Mantenha o relatório imutável na origem e conciliado no final.** Guarde a proposta submetida; acrescente resultados observados pelo runner e o resumo de `finish`. Só promova IDs a `aplicada` após commit confirmado. Suíte verde sem diff não deve gerar commit fictício.

13. **Meça custo em todas as requisições.** Some `usage` de análise, aplicação, retries e erros com consumo informado. Registre modelo realmente usado pelo RouteLLM e IDs das chamadas. Campos ausentes são “indisponível”, não zero; não duplique tokens em cache ou raciocínio.

14. **Proteja o próprio runner e o orçamento de Bia.** Credenciais, autorização, contadores e limites do Jorge ficam fora dos caminhos editáveis. O Review não deve acionar Bia nem alterar sua cota. O orçamento do Jorge é separado do `biaBudget`.

15. **Serialize versões e commits.** Use lock externo para evitar reviews concorrentes; confira a base antes de aplicar e publicar. O runner grava `tools/jorge/relatorios/harness-vN.md` e cria `feat(harness): harness-vN ...` somente após todos os portões; falha no commit não pode ser reportada como sucesso.
