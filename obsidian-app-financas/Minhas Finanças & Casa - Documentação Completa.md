# 🏡 Minhas Finanças & Central da Casa — Documentação Completa

> **Versão:** 2.0 (Hub da Família & Finanças)  
> **Usuários:** Alle, Kelly & Filhos  
> **Stack:** Next.js (App Router) • React • Tailwind/Vanilla CSS • Supabase (PostgreSQL) • LocalStorage (Offline-First)  
> **Última Atualização:** 24/08/2026

---

## 📑 Sumário

1. [Visão Geral do Projeto](#-visão-geral-do-projeto)
2. [Arquitetura & Stack Tecnológica](#-arquitetura--stack-tecnológica)
3. [Navegação & Estrutura de Abas](#-navegação--estrutura-de-abas)
4. [Detalhamento de Módulos](#-detalhamento-de-módulos)
   - [1. 🏠 Início (Dashboard Inteligente)](#1--início-dashboard-inteligente)
   - [2. 💳 Finanças (Central Financeira)](#2--finanças-central-financeira)
   - [3. 🛒 Desejos & Compras Planejadas](#3--desejos--compras-planejadas)
   - [4. ✅ Tarefas da Casa & Rotinas](#4--tarefas-da-casa--rotinas)
   - [5. ⚙️ Configurações](#5-️-configurações)
5. [Estrutura do Banco de Dados (Supabase)](#-estrutura-do-banco-de-dados-supabase)
6. [Regras de Negócio & Lógicas Especiais](#-regras-de-negócio--lógicas-especiais)
7. [Guia de Execução & Comandos](#-guia-de-execução--comandos)

---

## 🌟 Visão Geral do Projeto

O **Minhas Finanças & Casa** é uma aplicação completa de **gestão financeira, rotina doméstica e planejamento de compras para a família**. 

O app foi projetado para funcionar de forma leve, fluida e com visual escuro moderno (*Dark Theme*), otimizado tanto para computadores quanto para uso tátil no celular.

### Principais Pilares:
* **Transparência do Casal:** Controle de quem gastou o quê (`Alle`, `Kelly`, `Comum` e `Filhos`), calculando acertos de contas automaticamente.
* **Planejamento Financeiro Real:** Visão de saldo atual + saldo previsto no final do mês, despesas urgentes e faturas de cartões de crédito.
* **Central da Casa (Home Hub):** Lista de desejos com links de produtos e preços estimados, checklist de supermercado/feira e rotinas periódicas de manutenção doméstica.

---

## 🛠️ Arquitetura & Stack Tecnológica

* **Framework:** [Next.js](https://nextjs.org/) (App Router, Turbopack)
* **Frontend:** React 19, Tailwind CSS, Vanilla CSS, Lucide React (ícones), componentes visuais customizados
* **Backend:** [Supabase](https://supabase.com/) (PostgreSQL relacional)
* **Estratégia de Dados:** **Offline-First com Sincronização em Nuvem** — os dados salvam localmente via `localStorage` para resposta instantânea e sincronizam em tempo real com o Supabase (`app_settings`, `transactions`, `cartoes`).

---

## 🧭 Navegação & Estrutura de Abas

A interface utiliza **5 abas principais**, mantendo o layout limpo e sem poluição:

```
[ 🏠 Início ]  [ 💳 Finanças ]  [ 🛒 Desejos ]  [ ✅ Tarefas ]  [ ⚙️ Config ]
```

* **No Computador:** Barra de pílulas modernas no topo.
* **No Celular:** Barra de navegação fixa na parte inferior da tela, com ícones grandes e suporte a safe-area.

---

## 📦 Detalhamento de Módulos

### 1. 🏠 Início (Dashboard Inteligente)
* **Hero Card de Saldos:**
  * **Saldo Atual:** Soma editável em tempo real dos saldos em conta (`Saldo Alle + Saldo Kelly`).
  * **Previsto no Fim do Mês:** `Saldo Atual + Entradas Pendentes - Saídas Pendentes`.
  * Resumo rápido de receitas do mês, despesas pagas e total em faturas de cartões.
* **Alerta de Despesas Urgentes:** Banner inteligente no topo quando existem contas vencidas ou a vencer em até 7 dias.
* **Financiamentos & Parcelamentos:** Painel dedicado para acompanhamento de parcelas de longo prazo (ex: Imóvel, Terreno, Veículo).
* **Painel do Casal (Alle & Kelly):**
  * Gastos pessoais do Alle vs Gastos pessoais da Kelly.
  * Despesas Comuns divididas 50/50 com cálculo de quem pagou mais e mensagem de acerto de contas (ex: *"Kelly deve R$ 350,00 para Alle"*).
  * Barra gráfica de proporção percentual entre os dois.
* **Mini-Widgets da Casa:**
  * **Mini Tarefas:** Exibe as próximas 3 tarefas pendentes com atalho para a tela completa.
  * **Mini Desejos:** Exibe o próximo item prioritário da lista de desejos com o total planejado.

---

### 2. 💳 Finanças (Central Financeira)
Agrupa todas as ferramentas de dinheiro com **3 sub-abas discretas no topo**:

#### A. 📄 Transações & Lançamentos
* **Formulário Inteligente de Cadastro (`AddTransactionForm`):**
  * Tipos: `Despesa`, `Receita`, `Cartão de Crédito`.
  * Formatos: `Única`, `Fixa` (projeta automaticamente para os próximos 24 meses) e `Parcelada` (divide valor total ou replica valor por parcela em até 48x).
  * Responsável (`Quem`): `Comum (50/50)`, `Alle (Pessoal)`, `Kelly (Pessoal)`, `👶 Filhos (Crianças)`.
  * Meio de Pagamento: Conta Corrente ou Cartão de Crédito.
  * Categorias e Itens pré-configurados.
* **Lista de Transações (`TransactionList`):**
  * Separação visual entre **⏳ A Pagar** e **✅ Pagas**.
  * Filtros rápidos por: Tipo (`Receitas`, `Despesas`, `Cartões`), Status (`Todas`, `A Pagar`, `Pagas`) e Responsável (`Todos`, `Alle`, `Kelly`, `Comum`, `Filhos`).
  * Edição inline de boletos variáveis (ex: ajustar valor exato da conta de luz/água no momento do pagamento).
  * Consolidação automática de compras de cartão de crédito em um único card de fatura.

#### B. 💳 Faturas & Cartões de Crédito
* Cards visuais para cada cartão de crédito (Nubank, Inter, Sicoob, etc.).
* Exibição de: Limite Total, Gasto em Aberto no Mês, Limite Livre e Barra de Porcentagem de Uso.
* Datas de Fechamento e Vencimento.
* **Ajuste Manual de Fatura:** Permite definir o valor real da fatura fechada por mês.
* **Botão *"Pagar Fatura / Reabrir"***: Dá baixa em todas as compras do cartão naquele mês de uma só vez.
* **Listagem detalhada das compras** do cartão no mês selecionado.

#### C. 📊 Relatórios & Gráficos
* Gráfico de pizza por grupos de gastos (Essenciais, Estilo de Vida, Investimentos, Renda).
* Comparativo mês a mês.
* Exportação e Importação de dados via CSV.

---

### 3. 🛒 Desejos & Compras Planejadas (`Wishlist`)
Módulo voltado para planejar compras antes de comprometer o orçamento.

* **Campos de Cada Desejo:**
  * Nome do Produto.
  * Preço Estimado (R$).
  * **Link da Loja (URL):** Botão **🔗 Abrir Loja** para testar ou acessar direto no Mercado Livre, Amazon, Shopee, etc.
  * **Prioridade:** 🔴 *Alta (Urgente)*, 🟡 *Média (Próximo Mês)*, 🟢 *Baixa (Pode Esperar)*.
  * **Para Quem:** `🏡 Casa`, `Alle`, `Kelly`, `👶 Filhos`.
  * **Cômodo / Categoria:** *Cozinha*, *Quarto*, *Sala*, *Banheiro*, *Carro*, *Eletrônicos*, *Vestuário*, etc.
  * **Observações:** Medidas, voltagem (110v/220v), cupons de desconto, etc.
* **Ações Rápidas:**
  * **Botão *"COMPREI! (Lançar no Caixa)"*:** Cria automaticamente a transação de despesa paga no módulo financeiro e marca o item como comprado na vitrine.
  * **Totalizadores no Topo:** Total Planejado, Total Alta Prioridade e Total de Conquistas Já Compradas.
  * **Filtros e Busca:** Busca por texto, status (*Planejados* vs *Comprados*), prioridade e responsável.

---

### 4. ✅ Tarefas da Casa & Rotinas (`HouseTasks`)
Checklist minimalista e ágil focado na rotina da casa.

* **Visões / Sub-abas:**
  * **📋 Todas as Tarefas:** Visão geral de tudo que precisa ser feito.
  * **🛒 Mercado & Feira:** Checklist rápido para ir marcando itens com o celular na mão enquanto faz compras no mercado.
  * **🔄 Rotinas Periódicas:** Manutenções preventivas e rotinas recorrentes (`Diária`, `Semanal`, `Mensal`, `Semestral`, `Anual`).
* **Recursos do Módulo:**
  * **Barra de Inserção Rápida:** Digite a tarefa no topo e dê Enter.
  * **Barra de Progresso:** Percentual e contador de tarefas concluídas no dia.
  * **Atribuição:** `🏡 Casa`, `Alle`, `Kelly`, `👶 Filhos`.
  * **Data Limite:** Definição opcional de prazo com badge de calendário.
  * **Botão *"Limpar Concluídas"***: Limpa o histórico de tarefas finalizadas com um clique.

---

### 5. ⚙️ Configurações
* **Nomes do Casal:** Personalização dos nomes (padrão: *Alle* e *Kelly*) sincronizados automaticamente na nuvem.
* **Editor de Categorias:** Personalização de grupos, categorias e subitens.
* **Zona de Perigo:** Reset controlado de transações com confirmação de segurança.

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

### Tabela `transactions`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` / `text` | Chave primária |
| `description` | `text` | Nome da despesa/receita |
| `amount` | `numeric` | Valor em reais |
| `type` | `text` | `expense`, `income`, `credit` |
| `category` | `text` | Categoria principal |
| `subcategoria`| `text` | Item específico (opcional) |
| `date` | `timestamp with time zone` | Data do lançamento (sempre gravada com `T12:00:00` para evitar fuso horário) |
| `card_name` | `text` | Nome do cartão de crédito (se aplicável) |
| `installment_info` | `text` | Ex: `1/12`, `3/6` |
| `pago` | `boolean` | Status pago ou pendente |
| `fixa` | `boolean` | Flag de recorrência mensal fixa |
| `payment_method` | `text` | `checking` (conta corrente) ou `credit` (cartão) |
| `quem` | `text` | `Eu`, `Outro`, `Comum`, `Comum - Eu`, `Comum - Outro`, `Filhos` |
| `destino` | `text` | Local/destino do pagamento |

### Tabela `cartoes`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` / `text` | Chave primária |
| `nome` | `text` | Nome do cartão (ex: Nubank, Inter) |
| `limite` | `numeric` | Limite total do cartão |
| `vencimento` | `integer` | Dia de vencimento da fatura (1 a 31) |
| `fechamento` | `integer` | Dia de fechamento da fatura (1 a 31) |
| `bandeira` | `text` | MasterCard, Visa, Elo, etc. |

### Tabela `app_settings` (Configurações & Módulos Extras)
Armazena configurações globais em formato chave/valor JSON:
* `partner1` / `partner2`: Nomes configurados.
* `ajustes_faturas`: Reajustes manuais de faturas por mês/cartão.
* `wishlist`: Lista completa de compras desejadas com links, preços e prioridades.
* `tasks`: Lista completa de tarefas da casa, rotinas e itens de feira/mercado.

---

## 🧠 Regras de Negócio & Lógicas Especiais

### 1. Correção de Timezone (Fuso Horário Brasil UTC-3)
* Para evitar que datas salvas no dia `01/10` apareçam como `30/09`, todas as instâncias de datas são normalizadas com horário **`T12:00:00`** (meio-dia). Isso garante que variações de fuso horário ou horário de verão nunca desloquem a data para o dia anterior ou posterior.

### 2. Rateio do Painel do Casal
* Gastos marcados como `Eu` são 100% pessoais do Alle.
* Gastos marcados como `Outro` são 100% pessoais da Kelly.
* Gastos marcados como `Comum` são divididos 50% para cada.
* Se Alle pagou uma despesa comum (`Comum - Eu`), o app credita metade do valor como saldo a receber de Kelly, e vice-versa.

### 3. Backfill Automático de Despesas Fixas (24 Meses)
* Despesas marcadas como `fixa = true` são projetadas automaticamente para os próximos 24 meses futuros no banco de dados, permitindo previsibilidade financeira de longo prazo.

---

## 💻 Guia de Execução & Comandos

### Instalação de Dependências
```bash
cd appfinancas
npm install
```

### Rodar em Modo de Desenvolvimento
```bash
npm run dev
# Acesse em: http://localhost:3000
```

### Build de Produção
```bash
npm run build
```
