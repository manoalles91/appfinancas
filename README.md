# 🏡 Minhas Finanças & Central da Casa (v2.0)

Aplicação completa de controle financeiro do casal (**Alle & Kelly**), acompanhamento de despesas dos **Filhos**, lista de **Desejos & Compras Planejadas** com links externos, e gerenciador de **Tarefas & Rotinas da Casa**.

---

## 🧭 Estrutura de Navegação (5 Abas)

1. **🏠 Início:** Saldo atual, saldo previsto no fim do mês, despesas urgentes/vencidas, financiamentos, painel do casal com rateio automático e mini-widgets da casa.
2. **💳 Finanças:**
   - **📄 Transações & Lançamentos:** Formulário com suporte a despesas fixas (24 meses), parcelamentos até 48x e responsáveis (`Alle`, `Kelly`, `Comum`, `Filhos`).
   - **💳 Faturas & Cartões:** Limites, faturas mensais, reajustes e baixa rápida.
   - **📊 Relatórios:** Gráficos de categorias e comparativos mensais.
3. **🛒 Desejos:** Vitrine de compras planejadas com links de lojas (Mercado Livre, Amazon, etc.), preços estimados, prioridades e botão *"COMPREI!"* (lança direto no caixa).
4. **✅ Tarefas:** Checklist da casa com visões `Todas`, `🛒 Mercado / Feira` e `🔄 Rotinas Periódicas` (semanal, mensal, semestral, anual).
5. **⚙️ Configurações:** Nomes do casal/família, categorias e opções de dados.

---

## 🛠️ Tecnologias
* **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS, Lucide Icons
* **Backend:** Supabase (PostgreSQL)
* **Offline-First:** LocalStorage + Cloud Sync

## 🚀 Como Rodar Localmente
```bash
npm install
npm run dev
```
Acesse em: `http://localhost:3000`

---
*Para a documentação completa com detalhes do banco de dados e regras de negócio, consulte a nota no Obsidian Vault: `Minhas Finanças & Casa - Documentação Completa.md`.*
