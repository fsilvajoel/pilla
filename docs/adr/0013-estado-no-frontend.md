# ADR-0013 — Gerenciamento de estado no frontend

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Origem | Pergunta do Joel; [RFC-003](../rfc/RFC-003-stack-tecnologica.md) §4.4 |

## Contexto
O frontend é Next.js (App Router). Quase todo o "estado" do pilla é **dado do servidor** (contratos, parcelas, pagamentos), que já mora na API. Uma biblioteca de estado global usada para guardar dados do servidor cria uma segunda cópia que pode ficar desatualizada, o mesmo problema que a [ADR-0005](0005-valores-derivados.md) evita no backend.

## Decisão
Cada tipo de estado tem **um** lugar:

| Tipo de estado | Onde fica | Exemplo |
|---|---|---|
| Dados do servidor (leitura) | **Server Components** chamando a API | lista de contratos, portal do cliente |
| Dados do servidor (escrita) | **Server Actions** chamando a API + `revalidatePath` | registrar pagamento, criar contrato |
| Dados do servidor em tela interativa (atualização periódica, cache no cliente) | **TanStack Query**, só onde for necessário | painel do dia, se precisar atualizar sozinho |
| Formulários | **React Hook Form + Zod** (esquemas de `packages/schemas`) | simulação, cadastro |
| Filtros, paginação, aba selecionada | **URL** (`searchParams`) | "contratos em atraso, página 2" |
| Estado de um componente | `useState` / `useReducer` | modal aberto |
| Estado global do cliente (de verdade) | **Zustand** | futuro: chat do atendimento, preferências de interface |

Regras:
- **Proibido** copiar dados do servidor para Zustand/Context.
- Zustand é a ferramenta **aprovada** para estado global de cliente, mas só entra quando houver um caso real; o MVP provavelmente não precisa.
- A simulação de empréstimo calcula no navegador com `packages/finance` (sem chamada à API) e guarda os campos no formulário.

## Consequências
- Menos código e nenhuma cópia de dados para sincronizar.
- Links compartilháveis (filtros na URL).
- Os agentes têm uma tabela objetiva para decidir onde colocar cada estado.

## Alternativas consideradas
- **Zustand para tudo**: duplica o dado do servidor, exige invalidação manual.
- **Redux Toolkit**: cerimônia demais para o tamanho do MVP.
- **Só TanStack Query em client components**: perde as vantagens dos Server Components (menos JavaScript no navegador, que pesa no portal visto pelo celular).
