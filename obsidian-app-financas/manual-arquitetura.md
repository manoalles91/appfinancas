# Manual de Arquitetura - Estrutura do Aplicativo

## Visão Geral do Sistema

O **Minhas Finanças** é um aplicativo web de controle financeiro desenvolvido com a pilha tecnológica a seguir:

*   **Frontend:** React (Next.js 14+ com App Router).
*   **Estilização:** Tailwind CSS (configurado via `postcss.config.mjs` e `jsconfig.json`).
*   **Componentes UI:** Componentes customizados localizados em `src/components/ui/` (Card, Input, Button, etc.) seguindo o padrão `shadcn-ui`.
*   **Backend/Database:** Supabase (PostgreSQL) para autenticação, armazenamento de transações e configurações do usuário.
*   **Estado:** Gerenciamento de estado React puro (`useState`, `useEffect`, `useMemo`) com alguns cálculos derivados usando `useMemo`.

## Estrutura de Pastas (src/app e src/components)

A organização segue convenções do Next.js/React:

### Pastas Principais em `appfinancas/app/`

1.  **`page.js`**: É a "cena principal" (Home). É aqui que o estado global da aplicação é inicializado e onde ocorrem os efeitos colaterais mais complexos.
    *   *Funções chave:* `fetchData()` (busca no Supabase), `backfillFixas()` (gera transações fixas para os próximos 24 meses), `handleTogglePaid` (lógica de marcar/desmarcar pagamento e gerar novas parcelas), `cardsSummary` (cálculo do resumo dos cartões de crédito).

2.  **`nav-tabs/`** (implicit): Os tabs no topo da tela (Início, Transações, Cartões, Relatórios, Config).

### Pastas Principais em `appfinancas/components/`

1.  **`AddTransactionForm.js`**: O formulário principal para adicionar receitas, despesas ou cartões. Gerencia o estado do formulário do zero até o salvamento no banco.
2.  **`Dashboard.js`**: Componente responsável pela visualização resumo do mês corrente (cartões, gráficos, alertas de urgência).
3.  **`TransactionList.js`**: Lista de transações com ações de editar, excluir, toggle de pagamento.
4.  **`Reports.js`**: Geração de summaries e gráficos de gastos.
5.  **`CategoriesEditor.js`**: Interface para editar os grupos e categorias de despesas (salvo no `localStorage` e sincronizado com Supabase).

### Pastas Principais em `appfinancas/lib/`

1.  **`categories.js`**: O "cérebro" das categorias. Define quais grupos existem (Essenciais, Estilo de Vida, etc.) e mapeia o nome da categoria para o grupo ID. Usado tanto no frontend quanto poderia ser usado no backend (embora seja client-side aqui por usar `localStorage`).
2.  **`cloudSettings.js`**: Lida com a sincronização de configurações entre dispositivos (nomes dos parceiros, ajustes de fatura) via Supabase.
3.  **`supabase.js`**: Configuração do cliente Supabase (`import { supabase } from '@/lib/supabase'`). Contém as funções `loadCloudSettings` e `saveCloudSetting`.

## Fluxo de Dados Principais

### 1. Carregamento Inicial
1.  O componente `Home` (`app/page.js`) começa com `setLoading(true)`.
2.  `fetchData()` é chamado, buscando `transactions` e `cartoes` da tabela `public.transactions` e `public.cartoes` no Supabase, ordenados por data decrescente.
3.  Os dados são setados no estado: `setTransactions(txData)`, `setCartoes(cardsData)`.
4.  `setLoading(false)`.
5.  `useEffect` secundário chama `backfillFixas()` se existirem transações fixas no banco que precisam ser estendidas para o futuro (próximos 24 meses a partir da data mais recente existente).

### 2. Adição de Nova Transação
1.  Usuário preenche o `AddTransactionForm` e submete.
2.  `handleAddTransaction` é chamado.
3.  Monta um objeto `newTransaction` com os campos mapeados (description, amount, type, category, date, etc.).
4.  `supabase.from('transactions').insert([newTransaction])`.
5.  Em sucesso: `setTransactions(prev => [data[0], ...prev])` (insere na frente da lista).
6.  Toast de sucesso: `toast('Transação registrada com sucesso!')`.
7.  O formulário volta ao estado inicial `setFormData(initialForm())`.

### 2. Marcar/Desmarcar Fatura (Pago/Pendente)
1.  Usuário clica em "Pagar Faturo" ou "Reabrir Fatura" no card do cartão.
2.  `handlePayInvoice(cardName, targetStatus)` é chamado.
3.  Filtra as transações do cartão daquele mês.
4.  Faz `supabase.from('transactions').update({ pago: targetStatus }).in('id', txIds)`.
5.  Atualiza o estado local `setTransactions(prev => prev.map(t => txIds.includes(t.id) ? { ...t, pago: targetStatus } : t))`.

### 3. Lógica de "Fixas" (Backfill)
1.  O `backfillFixas()` roda automaticamente via `useEffect` quando os dados carregam.
2.  Ele pega todas as transações já existentes no banco que marcam `fixa: true` e `!installment_info`.
3.  Para cada grupo de transações com mesma descrição, ele pega a mais recente (de data mais recente).
4.  Ele calcula um "horizonte" de 24 meses a partir de "agora".
5.  Para cada mês futuro dentro desse horizonte que ainda não tem uma transação registrada, ele cria uma nova entrada no banco.
6.  **Importante:** Ele usa a mesma lógica de `Math.min(ref.getDate(), lastDay)` para garantir que o dia não fuja do mês (ex: dia 31 em abril becomes dia 30).

## Estado Global vs Local

*   **Local (`useState`):** O formulário `AddTransactionForm` gerencia seu próprio estado interno (`formData`) e o estado de abertura/fechamento (`showAdvanced`, `quemPagou`, etc.). Isso é "isolado" e não afeta outras partes da tela diretamente, exceto pelo callback `onAdd`.
*   **Global (`useState` no `Home`):** O `Home` gerencia `transactions`, `cartoes`, `viewDate` (mês que está sendo visto), `activeTab`. Quaisquer alterações aqui afetam todo o componentes pai, fazendo com que os filhos (`Dashboard`, `TransactionList`, `Cards`) se re-renderizem com novos dados.

---

# Manual de Categorias e Grupos

## Como o Sistema de Categorias Funciona

O aplicativo organiza despesas e receitas em uma estrutura hierárquica de **Grupos** > **Categorias**. Isso permite que os usuários filtrem, soma totais e visualize gráficos de forma intuitiva.

### 1. Definição das Categorias

A fonte da verdade para as categorias está em:
`appfinancas/lib/categories.js`

```javascript
export const CATEGORY_GROUPS = [
    {
        id: 'essenciais',
        label: 'Essenciais',
        emoji: '🏠',
        categories: [
            { name: 'Moradia', items: ['Parcela Casa', 'Aluguel', 'Condomínio', ...] },
            { name: 'Alimentação', items: ['Supermercado', 'Feira', ...] },
            // ... mais categorias
        ],
    },
    // ... outros grupos: estilo_vida, investimentos, renda
];
```

### 2. Como usar no Formulário

No `AddTransactionForm.js`:
1.  O componente busca as grupos via `getCategories()` (linha 41).
2.  O usuário seleciona um **Grupo** no primeiro `<select>`.
3.  Ao selecionar o Grupo, o estado `selectedGroup` é atualizado.
4.  Isso faz o segundo `<select>` (Categoria) ser preenchido apenas com as categorias daquele grupo específico (`categoryOptions` - linha 43-45).
5.  O usuário então escolhe o **Item** (ex: "Salário", "Aluguel") dentro da categoria selecionada.

### 3. Mapeamento para Grupos (Legacy)

Existe também um objeto `LEGACY_CATEGORY_GROUP` (linhas 49-69 do `categories.js`) que mapeia nomes de categorias antigas para IDs de grupos. Isso serve para compatibilidade com dados já salvos no `localStorage` antigamente.

### 4. No Dashboard e Relatórios

*   **Dashboard (`Dashboard.js`)**: Pega as transações do mês e as agrupa implicitamente pelas categorias definidas para calcular totais por grupo (ex: quanto se gastou em "Essenciais" vs "Estilo de Vida").
*   **Relatórios (`Reports.js`)**: Usa a categorização para desenhar gráficos de pizza ou barras, mostrando a distribuição de gastos ao longo do tempo.

### 5. Editor de Categorias

No `Config` tab, o `CategoriesEditor` permite:
*   **Renomear** um grupo ou categoria.
*   **Adicionar** novas categorias a um grupo existente.
*   **Excluir** categorias (com cuidado para não quebrar transações já existentes).

As alterações são salvas no `localStorage` (chave `fincasal_categorias_custom`) e também sincronizadas com a nuvem via `saveCloudSetting` no `page.js`.

---

# Manual de Troubleshooting (Solução de Problemas)

## Problemas Comuns e Como Corrigir

### 1. "O salário cai no dia 31 em vez do dia 1º"
*   **Causa:** Bug de fuso horário em JavaScript (ver `manual-visual.md` ou o arquivo `salary-scheduling.md` no Obsidian).
*   **Onde corrigir:** `appfinancas/components/AddTransactionForm.js` linhas 22 e 135. Forçar `T12:00:00.000Z`.

### 2. "As transações fixas duplicam ou someem"
*   **Causa:** O `backfillFixas()` está gerando registros duplicados no banco de dados, ou a lógica de `Math.min` não está funcionando corretamente para o dia escolhido.
*   **Onde verificar:** `appfinancas/app/page.js` função `backfillFixas()` (linhas 266-325). Verifique se já não existem as transações no banco antes de gerar novas.

### 3. "O valor da fatura do cartão está errado"
*   **Causa:** O cálculo no `cardsSummary` `useMemo` não está considerando os ajustes manuais salvos no `localStorage` ou o mês corrente está errado.
*   **Onde verificar:** `appfinancas/app/page.js` a partir da linha 169. Verifique a variável `ajusteVersion` e a função `getAjustesFaturas()`.

### 3. "Não consigo adicionar novas categorias"
*   **Causa:** O `localStorage` atingiu o limite ou o formato do JSON está corrompido.
*   **Onde verificar:** `appfinancas/lib/categories.js` função `getCategories()`. Ela tenta ler `localStorage.getItem(CUSTOM_KEY)` e fazer `JSON.parse`. Se der erro (`catch`), retorna o padrão `CATEGORY_GROUPS`.

### 4. "Os dados sumiram após atualizar a página"
*   **Causa:** Dependência do `localStorage` para algumas configurações (categorias customizadas), mas as transações principais estão no Supabase. Verifique se a autenticação do Supabase está funcionando e se o `fetchData` está sendo chamado no `useEffect` correto.

### 5. "O modal de adicionar cartão não abre/fecha"
*   **Causa:** Gerenciamento de estado `isAddCardModalOpen` no `page.js` (linha 41). Verifique se não há conflito de `onClick` ou estado falso.

---
*Este manual foi gerado para servir como "norte" para desenvolvimentos futuros e consulta rápida. As anotações detalhadas sobre timezone e lógica de recursão podem ser encontradas nos arquivos Markdown na pasta `obsidian-app-financas/`.*