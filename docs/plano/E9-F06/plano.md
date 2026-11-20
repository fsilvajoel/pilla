# Plano E9-F06: design system web (paleta verde clara, componentes shadcn, compostos shared/, casca do ADMIN)

Plano da feature (etapa 1 do workflow feature). Fontes: `docs/plano/E9.md` (D5, D6, D10), cartões E9-T11, E9-T12 e E9-T13 em `docs/plano/E9.yaml`, ADR-0013. A feature não depende de nenhuma outra e corre em paralelo ao backend.

## Escopo

Entra:
- **E9-T11 (implement, tela, Claude):** tokens claros em `apps/web/app/globals.css` com verde claro de destaque (D5); componentes primitivos instalados só pela CLI (`pnpm dlx shadcn@latest add ...`) em `apps/web/components/ui/`; variantes planejadas do `Badge` (`success` e `warning`) e os tokens `--success`, `--warning` (e `-foreground`) que elas usam.
- **E9-T12 (test-author, Bia):** testes dos compostos de `apps/web/components/shared/` (um `*.test.tsx` por composto).
- **E9-T13 (implement, tela, Claude):** compostos `PageHeader`, `EmptyState`, `FormField`, `DataTable`, `ConfirmDialog`, `StatusBadge` e a casca do ADMIN (`AdminShell` + `app/(admin)/layout.tsx`) com a sidebar do shadcn (Pessoas e Empréstimos) e o `Toaster` (sonner).

Fora: telas de pessoas (F08 a F10), cliente da API (F07), tema escuro (D5: só tema claro), login e guard (D3), componentes de domínio em `components/people/` (D6, nascem nas telas), refatorar as telas e os componentes antigos que já existem (`person-form.tsx`, `loan-*.tsx` etc.).

Tipo dos cartões: T11 e T13 são **tela** (layout e composição visual): levam `shadcn` e `tailwind-css` (e `react-best-practices`, `accessibility`, conforme o E9.yaml). T12 é test-author de componente: leva `accessibility` (tabela de skills de `cartao.md`) e `react-best-practices`, sem `shadcn` (decisão do PM em 19/11: o test-writer não precisa das regras de estilo, e a skill estourava o teto de skills); `escrever-teste` já vem do papel test-writer e não se repete no cartão.

Cartões: `docs/plano/E9.yaml`, IDs E9-T11, E9-T12, E9-T13.

## Componentes shadcn previstos (nomes do registro)

`button input label textarea select form card table badge dialog alert-dialog dropdown-menu sheet sidebar separator skeleton sonner tabs tooltip pagination breadcrumb avatar` (lista do done do E9-T11). Dependências que a CLI pode puxar: `sonner` e, no registro atual, `next-themes` (usado pelo `Toaster`), além de hook `use-mobile` (sidebar). Nenhum arquivo de `ui/` é escrito à mão; só o `badge.tsx` ganha as duas variantes planejadas.

## Paleta (D5)

Base clara (fundo branco, cinza muito claro em `muted`), verde claro em `--primary`, `--accent`, `--ring` e `--sidebar-*`; sem bloco `.dark`. Valores aprovados pelo PM sem ajuste de matiz (Decisões 2 e 3; o T11 usa exatamente estes valores; contraste calculado com a fórmula WCAG a partir de oklch):

| Token | Valor proposto | Par e razão de contraste |
|---|---|---|
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.145 0 0)` | 19,79 (mín. 4,5) |
| `--primary` / `--primary-foreground` | `oklch(0.84 0.15 152)` / `oklch(0.25 0.06 152)` | 10,15 (mín. 4,5) |
| `--muted-foreground` sobre `--background` | `oklch(0.5 0.02 152)` | 5,94 (mín. 4,5) |
| `--accent` / `--accent-foreground` | `oklch(0.95 0.05 152)` / `oklch(0.3 0.07 152)` | 11,66 (mín. 4,5) |
| `--success` / `--success-foreground` | `oklch(0.95 0.06 152)` / `oklch(0.35 0.09 152)` | 9,59 (mín. 4,5) |
| `--warning` / `--warning-foreground` | `oklch(0.96 0.08 90)` / `oklch(0.4 0.09 70)` | 8,23 (mín. 4,5) |
| `--destructive` sobre `--background` | `oklch(0.55 0.22 27)` | 5,43 (mín. 4,5) |
| `--ring` sobre `--background` | `oklch(0.6 0.15 152)` | 3,69 (mín. 3, componente de interface) |

O verde `--primary` sobre o branco tem contraste 1,55: serve de preenchimento com texto escuro por cima (par acima), nunca como cor de texto sobre branco. Fonte da exigência AA: D5.

## Contrato

Esboço em `docs/plano/E9-F06/esboco-shared.txt` (assinaturas que lançam `Error("esboço: não implementado")`; o orquestrador copia cada bloco para o arquivo indicado antes do E9-T12 e exclui da cobertura com o comentário `stub E9-F06` enquanto não for implementado). Os esboços importam só tipos de `react` e `lucide-react`, para compilar antes do E9-T11. Todos exportam nomeado (sem `export default`), são Server Components, salvo `AdminNav` (`"use client"`, usa `usePathname`) e `ConfirmDialog` (`"use client"`, recebe os callbacks `onConfirm` e `onOpenChange`).

- `apps/web/components/shared/page-header.tsx`: `PageHeader(props: PageHeaderProps): ReactElement`; `PageHeaderProps = { title: string; description?: string; actions?: ReactNode }`.
- `apps/web/components/shared/empty-state.tsx`: `EmptyState(props: EmptyStateProps): ReactElement`; `EmptyStateProps = { text: string; icon?: LucideIcon; action?: ReactNode }`.
- `apps/web/components/shared/form-field.tsx`: `FormField(props: FormFieldProps): ReactElement`; `FormFieldProps = { id: string; label: string; error?: string; description?: string; children: ReactElement }`. O controle (`children`) recebe `id`, `aria-invalid` e `aria-describedby` por `cloneElement`.
- `apps/web/components/shared/data-table.tsx`: `DataTable<Row>(props: DataTableProps<Row>): ReactElement`; `DataTableColumn<Row> = { key: string; header: string; cell: (row: Row) => ReactNode }`; `DataTableProps<Row> = { columns: readonly DataTableColumn<Row>[]; rows: readonly Row[]; getRowKey: (row: Row) => string; emptyText: string }`.
- `apps/web/components/shared/confirm-dialog.tsx` (cliente, `"use client"`): `ConfirmDialog(props: ConfirmDialogProps): ReactElement`; `ConfirmDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; destructive?: boolean }`. Usa `AlertDialog`.
- `apps/web/components/shared/status-badge.tsx`: `StatusBadge<K extends string>(props: StatusBadgeProps<K>): ReactElement`; `BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning"`; `StatusBadgeMap<K extends string> = Record<K, { label: string; variant: BadgeVariant }>`; `StatusBadgeProps<K> = { status: K; map: StatusBadgeMap<K> }`. Status fora do mapa é erro de tipo (não há valor em runtime a tratar). Os rótulos de status de cada tela vêm do chamador; o composto não conhece status de domínio.
- `apps/web/components/shared/admin-nav.tsx`: `ADMIN_NAV_ITEMS: readonly { label: string; href: string }[]` = `[{ label: "Pessoas", href: "/pessoas" }, { label: "Empréstimos", href: "/emprestimos" }]`; `AdminNav(): ReactElement` (`SidebarMenu` com link ativo por `usePathname`).
- `apps/web/components/shared/admin-shell.tsx`: `AdminShell(props: { children: ReactNode }): ReactElement` (`SidebarProvider` + `Sidebar` com marca "pilla" e `AdminNav` + `SidebarInset` com `SidebarTrigger` e `<main>` + `Toaster`).
- `apps/web/app/(admin)/layout.tsx`: `export default function AdminLayout(props: { children: ReactNode }): ReactElement`, só devolve `<AdminShell>`.

## Arquivos de produção

Viram `sources`; nenhum é domínio (apresentação e cola), portanto `domainSources` é vazio e não há critério `mut`. Ficam fora de `sources`: `apps/web/components/ui/**` (gerado pela CLI, já excluído da cobertura em `vitest.config.ts`) e `apps/web/app/globals.css` (CSS, sem cobertura de linhas).

| Arquivo | Domínio |
|---|---|
| `apps/web/components/shared/page-header.tsx` | não |
| `apps/web/components/shared/empty-state.tsx` | não |
| `apps/web/components/shared/form-field.tsx` | não |
| `apps/web/components/shared/data-table.tsx` | não |
| `apps/web/components/shared/confirm-dialog.tsx` | não |
| `apps/web/components/shared/status-badge.tsx` | não |
| `apps/web/components/shared/admin-nav.tsx` | não |
| `apps/web/components/shared/admin-shell.tsx` | não |
| `apps/web/app/(admin)/layout.tsx` | não |

## Domínio das entradas

A feature não tem entrada externa (campo de tela do usuário, parâmetro de API, arquivo lido ou variável de ambiente): os compostos recebem só props tipadas do código chamador. As linhas abaixo são as props com valor limite, para cobrir os casos de borda dos compostos; o erro de tipo (prop obrigatória ausente) é barrado pelo `typecheck`, não por teste.

| Entrada | Formato aceito | Mínimo | Máximo | Exemplos rejeitados (ou de borda) | Erro esperado | Fonte |
|---|---|---|---|---|---|---|
| `DataTable.rows` | lista de linhas | 0 linhas | sem limite (paginação é da tela) | lista vazia | não é erro: mostra `emptyText`, sem linha de dados | D6 (T12 done: "rows, empty") |
| `DataTable.columns` | lista de colunas com `key` única | 1 | sem limite | duas colunas com a mesma `key` | fora do escopo (tipos) | D6 |
| `FormField.error` | texto ou ausente | ausente | sem limite | `undefined`, `""` | ausente ou `""` = sem mensagem e sem `aria-invalid` | D6 (T12 done: "error message") |
| `PageHeader.description` e `actions` | opcionais | ausente | sem limite | ausente | ausente = não renderiza o bloco | D6 |
| `ConfirmDialog.open` | booleano | `false` | `true` | `false` | `false` = nada no DOM | D6 (T12 done: "confirm/cancel") |
| `StatusBadge.status` | chave do mapa | uma chave | sem limite | chave fora do mapa | erro de compilação (genérico `K`) | D6 (T12 done: "map of status to Badge variant") |

Não há limite numérico nem de formato vindo de PRD/RFC: é feature de interface. Os textos exatos de rótulos das telas (sidebar: "Pessoas", "Empréstimos") vêm do T13 done.

## Riscos

- Teste de componente com `Sidebar` precisa de `window.matchMedia` (hook `use-mobile`), que o jsdom não traz; `vitest.setup.ts` não está no `allowedPaths`. O teste do `AdminShell` define o stub de `matchMedia` no próprio arquivo.
- `AdminNav` usa `usePathname`: o teste mocka `next/navigation`.
- O registro do shadcn pode não ter `form` no estilo `radix-nova` (nas versões recentes o primitivo é `field`). Se a CLI recusar `form`, o T11 usa `field` e registra a troca; `FormField` não depende de `form`/react-hook-form (usa só `Label` e `cloneElement`), para não acoplar o composto à lib de formulário.
- `sonner` (e `next-themes`) entram como dependência nova em `apps/web/package.json`, prevista no `allowedPaths` do T11 e na lista do done; mas nenhuma das duas está em "Dependências permitidas" de `docs/travas.md` (§7: dependência nova exige aprovação do Joel), e o `check-allowed-deps` recusaria. Pergunta aberta em `pendencias-pm.md` (E9-T11); o T11 só roda depois da resposta. `Toaster` fora de `ThemeProvider` usa o tema `system`; como o MVP é só claro, o T13 passa `theme="light"`.
- Variante `Badge` `success`/`warning` é edição do arquivo gerado: só esta é permitida (D6). Reinstalar `badge` pela CLI a apagaria; o T11 deve registrar isso num comentário curto no arquivo.
- Coverage do web usa limite global de 85%, mas o gate de cobertura da feature exige 100% por arquivo de `sources`: os testes cobrem todos os ramos (com e sem `description`, `actions`, `error`, `icon`, link ativo e inativo).
- Contraste AA sem teste automático (ver Decisões, 1).
- Os atributos `data-variant` (A5, A6, C20) só existem depois do T11, que gera `button.tsx` e `badge.tsx`; a conferência deles é feita na revisão dos testes, depois do T11.

## Dependências

- Nenhuma feature. Pré-condições já no repositório: `components.json` (estilo `radix-nova`, aliases `@/components/ui`), Tailwind 4 e `tw-animate-css` instalados, `lib/utils.ts` com `cn()`.
- Internas: E9-T12 não depende de E9-T11 (o esboço não importa `components/ui`, então os testes falham por asserção, não por import, antes da implementação; a conferência de `data-variant` contra `badge.tsx` vai para a revisão dos testes, depois do T11); E9-T13 depende de E9-T12.
- Consumida por E9-F07 a F10 (`shared/` e casca).

## Critérios de aceite

Molde fixo: entrada, domínio, saída, erro, fonte, camada. Todos os testes ficam em `apps/web/components/shared/` (único caminho de teste do `allowedPaths` do E9-T12).

### A1: PageHeader mostra título, descrição e ações
- entrada: `title="Pessoas"`, `description="Cadastro de clientes"`, `actions=<button>Nova pessoa</button>`; e uma segunda renderização só com `title="Pessoas"`.
- domínio: `PageHeader.description` e `actions` presentes e ausentes.
- saída: com tudo, um `heading` de nível 1 com o nome "Pessoas", o texto "Cadastro de clientes" e o botão "Nova pessoa"; só com título, o heading e nenhum outro texto nem botão.
- erro: nenhum.
- fonte: D6 (compostos `shared/`); E9-T12 done (title, description, actions).
- camada: unit

### A2: EmptyState mostra ícone, texto e ação
- entrada: `text="Nenhuma pessoa cadastrada"`, `icon=Users`, `action=<button>Cadastrar</button>`; e uma segunda só com `text`.
- domínio: `EmptyState.icon` e `action` presentes e ausentes.
- saída: com tudo, o texto, um `svg` de ícone com `aria-hidden="true"` e o botão "Cadastrar"; só com texto, o texto sem `svg` e sem botão.
- erro: nenhum.
- fonte: D6; E9-T12 done (icon, text, action).
- camada: unit

### A3: FormField liga rótulo, controle e mensagem de erro
- entrada: `id="cpf"`, `label="CPF"`, `error="CPF inválido"` e um `<input>` como filho; e `error` ausente ou `""`; e `description="Só números"`.
- domínio: `FormField.error` presente, ausente e `""`.
- saída: `getByLabelText("CPF")` devolve o `<input id="cpf">`; com erro, o texto "CPF inválido" aparece com `role="alert"` e `id="cpf-error"`, o input tem `aria-invalid="true"` e `aria-describedby` contém `cpf-error`; sem erro e com `error=""`, não há `role="alert"` e o input não tem `aria-invalid="true"`; com `description`, o texto aparece com `id="cpf-description"` e `aria-describedby` o cita.
- erro: nenhum.
- fonte: D6; E9-T12 done (label, control, error message); WCAG 2.1 (skill accessibility). Os ids `cpf-error` e `cpf-description` foram aprovados pelo PM em 19/11 (Decisões, 5).
- camada: unit

### A4: DataTable mostra cabeçalhos, linhas na ordem e o texto de vazio
- entrada: colunas `[{key:"name",header:"Nome",cell:r=>r.name},{key:"phone",header:"Telefone",cell:r=>r.phone}]`, linhas `[{id:"1",name:"Ana",phone:"+5511999990001"},{id:"2",name:"Bia",phone:"+5511999990002"}]`, `getRowKey=r=>r.id`, `emptyText="Nenhum resultado"`; e `rows=[]`.
- domínio: `DataTable.rows` com 0, 2 e N linhas; `columns` com 1 ou mais colunas.
- saída: 2 `columnheader` ("Nome", "Telefone") e, no corpo, 2 linhas com as células "Ana", "+5511999990001", "Bia", "+5511999990002" nessa ordem; com `rows=[]`, os cabeçalhos continuam, o texto "Nenhum resultado" aparece e não há linha de dados. Propriedade: para qualquer lista de linhas com ids distintos (0 a 20), com N > 0 o corpo (`rowgroup` do `tbody`) tem exatamente N `row`; com 0, tem exatamente 1 `row`, a de vazio, com o texto de vazio; o texto de vazio aparece se e somente se `rows.length === 0`.
- erro: nenhum.
- fonte: D6; E9-T12 done (columns, rows, empty).
- camada: unit, prop

### A5: ConfirmDialog confirma e cancela
- entrada: `open=true`, `title="Excluir endereço?"`, `description="Esta ação não pode ser desfeita."`, `confirmLabel="Excluir"`, `cancelLabel="Cancelar"`, com `onConfirm` e `onOpenChange` espiões; e `open=false`.
- domínio: `ConfirmDialog.open` verdadeiro e falso; `destructive` ausente e `true` (prop do contrato; exigida pela cobertura de 100%).
- saída: aberto, `alertdialog` com o nome "Excluir endereço?", o texto da descrição e os botões "Excluir" e "Cancelar"; clicar "Excluir" chama `onConfirm` 1 vez; clicar "Cancelar" chama `onOpenChange` com `false` e `onConfirm` 0 vezes; fechado, nenhum `alertdialog` no DOM. Com `destructive=true`, o botão "Excluir" tem `data-variant="destructive"`; sem `destructive`, `data-variant="default"` (atributo conferido contra o `button.tsx` gerado).
- erro: nenhum.
- fonte: D6; E9-T12 done (confirm/cancel); contrato `ConfirmDialogProps.destructive` (esboço).
- camada: unit

### A6: StatusBadge mostra o rótulo e a variante do mapa
- entrada: `map={ ativo:{label:"Ativo",variant:"success"}, inativo:{label:"Inativo",variant:"secondary"}, pendente:{label:"Pendente",variant:"warning"} }` com `status="ativo"`, `"inativo"` e `"pendente"`.
- domínio: `StatusBadge.status` = cada chave do mapa; `map` com as 6 variantes de `BadgeVariant`.
- saída: o texto exibido é `label` da chave (`"Ativo"`, `"Inativo"`, `"Pendente"`) e o elemento carrega a variante da chave (`data-variant="success"`, `"secondary"`, `"warning"`; atributo conferido contra o `badge.tsx` gerado). Propriedade: para qualquer mapa de 1 a 6 chaves e qualquer chave dele, o texto exibido é o `label` dessa chave.
- erro: nenhum em runtime (chave fora do mapa é erro de tipo).
- fonte: D6; E9-T12 done (map of status to Badge variant); E9-T11 done (variantes `success` e `warning`).
- camada: unit, prop

### A7: casca do ADMIN com sidebar, navegação e Toaster
- entrada: `AdminShell` com filho `<p>Conteúdo</p>`, `usePathname` mockado devolvendo `"/pessoas/nova"`, depois `"/emprestimos"`, depois `"/"`; e `AdminLayout` com o mesmo filho.
- domínio: pathname dentro de uma seção, em outra seção e fora de ambas. Regra do link ativo, aprovada pelo PM em 19/11 (Decisões, 5): ativo se `pathname === href` ou `pathname` começa com `href + "/"`.
- saída: o filho aparece dentro de `<main>`; a marca "pilla" aparece na sidebar (contrato do `AdminShell`); a navegação (`navigation`) tem os links "Pessoas" (`href="/pessoas"`) e "Empréstimos" (`href="/emprestimos"`), nessa ordem, e só esse; o link da seção atual tem `aria-current="page"` e o outro não (em `"/pessoas/nova"` o ativo é "Pessoas"; em `"/emprestimos"` é "Empréstimos"; em `"/"` nenhum); a região do `Toaster` existe (`section` cujo `aria-label` contém "Notifications"; o rótulo exato depende da versão do sonner e é conferido no T11); `AdminLayout` renderiza o mesmo filho dentro da casca.
- erro: nenhum.
- fonte: E9-T13 done ("shadcn sidebar with Pessoas and Empréstimos, and the Toaster"); ADR-0013; rotas existentes `app/(admin)/pessoas` e `app/(admin)/emprestimos`.
- camada: unit

## Cenários

- C1 (A1, unit): `PageHeader` com título, descrição e ação mostra o heading "Pessoas", "Cadastro de clientes" e o botão "Nova pessoa" (fonte D6).
- C2 (A1, unit): `PageHeader` só com título mostra o heading e não renderiza descrição nem ação.
- C3 (A2, unit): `EmptyState` com ícone, texto e ação mostra o texto, o `svg` com `aria-hidden="true"` e o botão "Cadastrar".
- C4 (A2, unit): `EmptyState` só com texto não renderiza `svg` nem botão.
- C5 (A3, unit): `FormField` com `error="CPF inválido"` mostra o alerta, `aria-invalid="true"` e `aria-describedby` com `cpf-error`.
- C6 (A3, unit): `FormField` sem `error` e com `error=""` (rejeição: mensagem vazia não é erro) não tem alerta nem `aria-invalid="true"`.
- C7 (A3, unit): `getByLabelText("CPF")` devolve o input `id="cpf"`; com `description`, o texto aparece e é citado em `aria-describedby`.
- C8 (A4, unit): duas linhas (Ana, Bia) aparecem na ordem com cabeçalhos "Nome" e "Telefone".
- C9 (A4, unit): `rows=[]` mostra "Nenhum resultado" e nenhuma linha de dados (rejeição de entrada vazia).
- C10 (A4, prop): para qualquer lista de 0 a 20 linhas com ids distintos, o número de linhas de dados é o tamanho da lista e o texto de vazio aparece só quando é 0.
- C11 (A5, unit): aberto, o `alertdialog` mostra título, descrição e os dois botões; "Excluir" chama `onConfirm` uma vez.
- C12 (A5, unit): "Cancelar" chama `onOpenChange(false)` e não chama `onConfirm`.
- C13 (A5, unit): `open=false` não renderiza `alertdialog` (rejeição: diálogo fechado).
- C14 (A6, unit): `status="ativo"` mostra "Ativo" com variante `success`; `"inativo"` mostra "Inativo" com `secondary`; `"pendente"` mostra "Pendente" com `warning`.
- C15 (A6, prop): para qualquer mapa de 1 a 6 chaves e qualquer chave dele, o texto exibido é o `label` da chave.
- C16 (A7, unit): em `/pessoas/nova` o link "Pessoas" tem `aria-current="page"` e "Empréstimos" não; os `href` são `/pessoas` e `/emprestimos`; o filho está em `<main>`; a marca "pilla" aparece.
- C17 (A7, unit): em `/emprestimos` o ativo é "Empréstimos".
- C18 (A7, unit): em `/` nenhum link tem `aria-current` (rejeição: pathname fora das seções).
- C19 (A7, unit): `Toaster` presente na casca; `AdminLayout` renderiza o filho dentro da casca.
- C20 (A5, unit): com `destructive=true` o botão "Excluir" tem `data-variant="destructive"`; sem a prop, `data-variant="default"`.

## Arquivos de teste previstos

Pacote `@pilla/web` (`pnpm --filter @pilla/web exec vitest run components/shared`); todos unit, e prop onde indicado:
- `apps/web/components/shared/page-header.test.tsx` (C1, C2)
- `apps/web/components/shared/empty-state.test.tsx` (C3, C4)
- `apps/web/components/shared/form-field.test.tsx` (C5, C6, C7)
- `apps/web/components/shared/data-table.test.tsx` (C8, C9; C10 prop com fast-check)
- `apps/web/components/shared/confirm-dialog.test.tsx` (C11, C12, C13, C20)
- `apps/web/components/shared/status-badge.test.tsx` (C14; C15 prop)
- `apps/web/components/shared/admin-shell.test.tsx` (C16 a C19; importa `@/app/(admin)/layout` para o C19; stub de `matchMedia` e mock de `next/navigation` no arquivo)
- e2e: nenhum (sem critério e2e; a navegação de ponta a ponta é da E9-F11).

## Verificação sem critério A<n>

Itens do done do E9-T11 que não são comportamento testável por unit e ficam com os checks do cartão (`typecheck`, `lint`, `build`) e com a revisão final: componentes da lista instalados só pela CLI (conferir `git diff`: os arquivos de `ui/` coincidem com a saída da CLI, exceto `badge.tsx`); `globals.css` sem bloco `.dark`; `Button` mantém as variantes do shadcn.

## Decisões (19/11, resposta do Joel)

1. **Prova do contraste AA (D5): conferência manual.** O reviewer confere os pares com a tabela da seção Paleta; não há script novo nem `scripts/` no `allowedPaths`.
2. **Paleta: aprovada** a proposta (verde claro, `--primary` `oklch(0.84 0.15 152)`), sem ajuste de matiz.
3. **Badge `success`/`warning`: aprovadas** as cores propostas.
4. **`AdminShell` e `AdminNav` em `shared/`: aprovado.** São testados em `shared/`; o done do E9-T13 cita isso e o `layout.tsx` só compõe os dois.
5. **Ids `<id>-error` e `<id>-description` do `FormField` e regra do link ativo do `AdminNav`: aprovados** (resposta a) em `docs/plano/pendencias-pm.md`, 19/11).
