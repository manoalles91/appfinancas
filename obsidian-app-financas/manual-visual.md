# Manual Visual - Interface do Usuário

## Visão Geral

O **Minhas Finanças** é um aplicativo de controle financeiro compartilhado entre dois parceiros (padrão: Alle & Kelly). Ele funciona como um "dashboard" único onde ambos podem ver, adicionar e categorizar transações.

## Navegação (Tabs)

O app possui 5 abas principais no menu superior:

| Ícone | Rótulo | Descrição |
| :---: | --- | --- |
| 🏠 | **Início** | Visão geral do mês, saldo, transações urgentes e dashboard de gastos. |
| ➡️ | **Transações** | Cadastro de novas despesas/receitas, importação CSV, lista de todas transações. |
| 💳 | **Cartões** | Visão dos cartões de crédito, faturas, limite e compras do mês. |
| 📊 | **Relatórios** | Gráficos e summaries de gastos por categoria ao longo do tempo. |
| ⚙️ | **Configurações** | Nomes dos parceiros, editor de categorias e ajustes finos. |

## Fluxo de Cadastro de Transação

### 1. Página "Início" (Tab principal)
- Ao clicar no `+ Adicionar` (ou ao abrir o formulário rápido), abre-se o **AddTransactionForm**.
- O usuário escolhe: **Tipo** (Despesa/Receita/Cartão), **Valor**, **Data**, **Categoria**.
- Ao salvar, os dados são enviados para o Supabase e aparecem imediatamente na lista.

### 2. Página "Transações" (Tab secundária)
- Aqui tem mais controles: filtro por cartão, status (Pago/Pendente), edição e exclusão em massa.
- Também contém o **CSV Manager** para importar várias transações de uma vez.

### 3. Página "Cartões" (Tab de gestão)
- Cada cartão tem um limite e uma data de vencimento.
- O sistema calcula automaticamente o **valor em aberto** (fatura) para o mês atual.
- Existe a funcionalidade de **"Reajustar Fatura"**, onde você pode alterar o valor total da fatura manualmente (útil se o cartão cobrar taxas ou se você fez pagamentos antecipados).
- Há também a opção de **"Pagar Fatura"**, que marca todas as compras do mês como pagas.

### 4. Página "Relatórios"
- Apresenta gráficos de gastos pessoais vs acertos compartilhados.
- Permite filtrar por mês e visualizar tendências.

### 5. Página "Configurações"
- Permite mudar os nomes dos parceiros (Alle/Kelly).
- Possui o **Categories Editor**, onde você pode criar, editar ou excluir categorias de despesas (ex: criar a categoria "Igreja" que o usuário mencionou).
- Sincronização com nuvem (Supabase) para que os nomes dos parceiros e categorias sejam mantidos entre celulares e computadores.

## Fluxo de Dados

1.  **Frontend (React):** Os componentes (`AddTransactionForm`, `Dashboard`, etc.) gerenciam o estado local (`useState`) e buscam dados do **Supabase** ao carregar a página ou ao submeter um formulário.
2.  **Backend (Supabase):** Serve como banco de dados relacional e autenticação. Todas as transações, cartões e configurações são salvas aqui.
3.  **Sincronização:** Sempre que uma alteração é feita (ex: marcar uma fatura como paga), o frontend atualiza o estado local e faz um `UPDATE` no Supabase. Em seguida, ele refetch os dados para refletir a mudança na UI.

---

# Manual de Lógica e Código

Este manual serve como guia para desenvolvedores ou IAs que precisam mexer no código-fonte (`appfinancas/`).

## 1. Lógica de Transações "Fixas" (Recorrentes)

### O Problema
Quando se cadastra uma transação do tipo "Fixa" (ex: aluguel, salário), o sistema gera cópias dessa transação para os próximos 24 meses. Originalmente, havia um bug de **fuso horário**: ao salvar a data `01/10/2026`, o JavaScript converteva `00:00` (metade-noite) para o fuso UTC-3 do Brasil, fazendo a data "pular" para o dia 30 de setembro.

### A Solução Aplicada
Forçou-se o horário para **12:00 (meio-dia)** em todos os pontos de salvamento de data. O meio-dia é o "pivô" seguro: não há troca de dia ao converter entre fuso horários.

### Onde encontrar o código

| Arquivo | Linhas Chave | O que faz |
| :--- | :--- | :--- |
| `appfinancas/components/AddTransactionForm.js` | **22** | Define a data padrão do formulário com `T12:00:00.000Z`. |
| `appfinancas/components/AddTransactionForm.js` | **135** | Salva transações fixas recorrentes com o horário de meio-dia. |
| `appfinancas/components/AddTransactionForm.js` | **100, 123, 151** | Outras operações de data que também foram corrigidas para `T12:00:00`. |
| `appfinancas/app/page.js` | **275, 287, 304, 443, 445, 537, 572** | Já trazia a correção em vários pontos de backfilling e atualização de transações. |

### Como funciona a recorrência (Lógica interna)

No `AddTransactionForm.js` (linhas 122-144), quando o formato é "fixa":

1.  Pega a data base que o usuário escolheu (já forçada para 12:00).
2.  Para cada um dos próximos **24 meses** (loop `for i in 24`):
3.  Calcula o novo mês: `baseDate.getMonth() + i`.
4.  Descobre o último dia daquele mês: `new Date(year, month + 1, 0).getDate()`.
5.  **Aplica o `Math.min(baseDate.getDate(), lastDay)`**.
    *   Se o usuário escolheu o dia 31, e o mês tem 30 dias, o sistema pega o mínimo (30).
    *   Se o usuário escolheu o dia 1, funciona em todos os meses (1 é menor que 30, 28, etc.).
6.  Cria o objeto da transação com a data calculada.

---

## 2. Lógica de Cartões de Crédito

### Como a fatura é calculada

Na página `Cartões`, o sistema exibe o "valor em aberto" da fatura atual.

### Onde encontrar o código

O cálculo principal ocorre no arquivo `app/page.js`, dentro do `useMemo` chamado `cardsSummary` (aproximadamente linhas 169-204).

**Resumo da lógica:**
1.  Pega todas as transações do mês corrente (`viewDate`).
2.  Filtra apenas as transações do cartão específico (`card.nome`).
3.  Filtra apenas do tipo `'credit'`.
4.  Soma os valores (`reduce`) das transações daquele mês.
5.  Verifica se existe um "ajuste" manual (`getAjustesFaturas` do `localStorage`).
    *   Se houver ajuste, usa o valor ajustado.
    *   Se não, usa a soma simples.

### Reajuste Manual da Fatura

No `app/page.js` (linhas 398-429), há a função `openFaturaAdjust` e `saveFaturaAdjust`.

*   Permite ao usuário digitar um novo valor para a fatura.
*   Esse valor é salvo no `localStorage` com a chave `fincasal_ajustes_faturas`.
*   Impede que o sistema "some" pagamentos feitos manualmente ou taxas extras da fatura.

---

## 3. Sistema de Categorias

### Como as categorias funcionam

O app organiza despesas em **Grupos** e **Categorias**.

*   **Grupos:** `essenciais`, `estilo_vida`, `investimentos`, `renda`.
*   **Categorias:** Ex: `Moradia`, `Alimentação`, `Salário`, `Freelas`.

### Onde encontrar o código

`appfinancas/lib/categories.js` (linhas 1-47).

*   Define o `CATEGORY_GROUPS`: Um array de objetos contendo o ID, rótulo, emoji e a lista de itens.
*   Exporta a função `getGroupId(category)`: Busca qual grupo aquela categoria pertence.
*   Exporta a função `getGroupInfo(id)`: Retorna as informações do grupo dado o ID.

No `app/page.js` (linha 15), essas funções são importadas: `import { getCategories, getGroupId } from '@/lib/categories';`

**No formulário de transação (`AddTransactionForm.js`):**
*   O usuário pode selecionar um **Grupo** (o que filtro as categorias disponíveis).
*   Depois seleciona a **Categoria** dentro daquele grupo.
*   No relatórios, as transações são agrupadas por essas categorias para calcular totais.

---

## 4. Bancos de Dados (Supabase)

### Tabelas Principais

1.  **`transactions`**: O coração do app.
    *   `id`, `date`, `amount`, `type`, `category`, `description`, `pago`, `fixa`, `card_name`, `quem`, etc.
2.  **`cartoes`**: Dados dos cartões de crédito.
    *   `id`, `nome`, `limite`, `vencimento` (dia do mês), `fechamento` (dia do fechamento da fatura).

### Relação entre as tabelas

*   Um **Cartão** pode ter muitas **Transações** (um para muitos).
*   A coluna `card_name` na tabela `transactions` faz o link com a tabela `cartoes` para filtrar faturas.

---

# Guia Rápido para a IA (Prompt Engineer)

Se a IA precisar modificar o código, siga este roteiro:

### Cenário A: "Quero mudar a cor das categorias"
1.  Vá em: `appfinancas/lib/categories.js`.
2.  Altere a propriedade `color` dentro dos objetos `CATEGORY_GROUPS` ou nos componentes `CategoryIcon.js`.

### Cenário B: "Quero adicionar um novo campo no formulário de transação"
1.  Vá em: `appfinancas/components/AddTransactionForm.js`.
2.  Adicione o estado no `initialForm()` (linha 17-33).
3.  Adicione o campo de entrada no retorno JSX (após linha 240, na seção de "Advanced options").
4.  No `handleSubmit`, adicione o envio do novo campo no payload (linhas 82-171).

### Cenário C: "O salário está caindo no dia errado em meses curtos"
1.  Vá em: `appfinancas/components/AddTransactionForm.js:129`.
2.  Verifique se a data base foi salva com `T12:00:00.000Z`.
3.  Verifique a linha `Math.min(baseDate.getDate(), lastDay)`. Se o dia base for 1, isso funcionará perfeitamente em todos os meses.

### Cenário D: "Quero mudar quantos meses a transação fixa gera"
1.  Vá em: `appfinancas/components/AddTransactionForm.js:125`.
2.  Altere o número `24` no `for (let i = 0; i < 24; i++)`.

### Cenário E: "Quero mudar a lógica de fuso horário novamente"
1.  Verifique todos os lugares onde `new Date(... + 'T12:00:00')` ou `.toISOString().replace('.000Z', 'T12:00:00.000Z')` aparecem em:
    *   `appfinancas/components/AddTransactionForm.js`
    *   `appfinancas/app/page.js`
2.  Se precisar mudar de `12:00` para outro horário, certifique-se de que o novo horário não cause troca de dia em UTC-3 (evite `00:00` e `18:00`/ `20:00`).