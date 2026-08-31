# 🛠️ Melhorias aplicadas — Sessão 28/08/2026

> **Escopo:** Segurança, robustez, limpeza de código, acessibilidade, audit trail, notificações e tempo real.
> **Status:** Código pronto e validado (lint + build). Alguns itens dependem de **acionar o SQL do Supabase** para ter efeito real no servidor (veja o final).

---

## 1. 🔒 Segurança

### PIN mais forte (PBKDF2 + salt por dispositivo)
- O PIN **não é mais** um SHA-256 simples com salt fixo (fraco e previsível).
- Agora usa **PBKDF2** (SHA-256, 100 mil iterações) com **salt aleatório por dispositivo** (guardado no `localStorage`).
- Hashes antigos continuam funcionando (compatíveis na verificação); ao trocar o PIN, o novo já usa o formato seguro.
- Arquivo: `lib/security.js`

### Bloqueio contra tentativas (anti brute-force)
- Na tela de desbloqueio, após **5 tentativas erradas** o teclado trava por **30 segundos** e mostra quantas tentativas faltam.
- Arquivo: `components/AppLock.js`

### PIN obrigatório no reset destrutivo
- A ação **"APAGAR TUDO"** (Zona de Perigo, que exclui todas as transações) agora exige:
  1. Digitar a palavra `RESETAR`; **e**
  2. **Digitar o PIN correto** (se houver PIN configurado).
- O botão fica bloqueado até preencher os dois. Também há trava contra duplo clique.
- Arquivo: `app/page.js` (handler `handleResetAllTransactions`)

### Login (Supabase Auth) — tela + cartão de conta
- **Auth Screen** (`components/AuthScreen.js`): tela de **Entrar / Criar conta** com e-mail e senha.
- **Cartão "Conta & Segurança na Nuvem"** na aba Configurações: mostra se você está **Conectado** (qual e-mail) ou **Visitante**, com botões **Entrar** e **Sair**.
- O login é **opcional** por padrão. Para tornar obrigatório: ative `NEXT_PUBLIC_REQUIRE_AUTH=true` no `.env.local`.
- Arquivos: `lib/auth.js`, `components/AuthScreen.js`, `app/page.js`

> ⚠️ **Importante:** o login e o PIN protegem a **interface** (tela). Para proteger os **dados no servidor**, é preciso ativar a **Row Level Security (RLS)** rodando o SQL — veja a seção 6.

---

## 2. 🧱 Robustez (erros e carregamento)

- **Carregamento independente:** se a busca de transações ou cartões falhar, a outra ainda carrega (antes, uma falha derrubava tudo).
- **Banner de erro** no topo com botão **"Tentar novamente"** quando o Supabase falha.
- **Banner offline:** detecta quando você perde a conexão (âmbar) e avisa ao reconectar.
- `saveCloudSetting` agora **retorna sucesso/falha** em vez de engolir o erro.
- Arquivo: `app/page.js`, `lib/cloudSettings.js`

---

## 3. 🧹 Código mais limpo

- Criado **`lib/format.js`** com `formatCurrency`, `formatDate`, `monthKey`, `parseAmount`.
- Removida a duplicação de formatação que existia em **6 componentes** (Dashboard, Balances, Financiamentos, Reports, Wishlist, TransactionList).
- Corrigidos avisos/erros de lint pré-existentes no `TransactionList.js` (`consolidateCards`, dependências de `useMemo`).

---

## 4. ♿ Acessibilidade

- `role="dialog"` / `aria-modal` na tela de bloqueio.
- `aria-label` em botões de ícone (Configurações, Bloquear, teclado do PIN).

---

## 5. ✨ Novas funcionalidades

### Audit trail (histórico de alterações)
- Registra em uma tabela **`audit_log`** as ações: edição/split, ajuste de valor, marcar pago/não pago, exclusão e reset total.
- Novo **"Histórico de Alterações"** na aba Configurações (lista as últimas ações com data).
- Arquivos: `lib/audit.js`, `components/AuditLogViewer.js`
- Funciona em **modo best-effort**: se a tabela `audit_log` ainda não existir, o app continua funcionando normalmente.

### Notificações de despesas urgentes
- Toast automático (1× por sessão) avisando despesas **vencidas ou vencendo em até 7 dias**, com o total em R$.

### Tempo real (multidispositivo)
- O app **escuta mudanças** nas tabelas `transactions` e `cartoes` e atualiza sozinho quando algo muda em outro aparelho.
- Requer o Supabase Realtime (padrão nas tabelas do Supabase).

### Saldo automático (receita/despesa mexem no saldo)
- Antes, o saldo era **só manual**: as transações não alteravam o saldo; você precisava ajustar à mão em Configurações.
- Agora, ao **marcar uma transação como paga/recebida**, aparece um popup **"Quem pagou? / Quem recebeu?"** com {partner1} e {partner2}:
  - **Receita** (ex.: salário) → o valor **entra** no saldo de quem recebeu.
  - **Despesa** (conta/débito) → o valor **sai** do saldo de quem pagou.
  - **Cartão de crédito** → **não** desconta na hora (só quando a fatura for paga).
- Ao **desmarcar** como pago, o saldo é **revertido** automaticamente.
- O saldo manual continua existindo; as transações passam a mexer nele por cima.
- Arquivos: `lib/saldo.js` (novo, centraliza leitura/escrita do saldo), `app/page.js`, `components/Balances.js`.

> **Nota de comportamento:** para a transação do salário, ao marcar como "recebida" você escolhe quem recebeu (ex.: Alle) e o valor é somado ao saldo dela na hora.

---

## 6. 🚀 Para ATIVAR as proteções no servidor (você precisa fazer)

Os itens de **RLS (segurança de dados), owner por linha, audit_log e usuários** só têm efeito real no Supabase depois de:

1. Abrir o **SQL Editor** no painel do [Supabase](https://supabase.com/dashboard).
2. Colar e executar o conteúdo de **`appfinancas/supabase/rls.sql`**.
3. No `.env.local`, adicionar:
   ```
   NEXT_PUBLIC_REQUIRE_AUTH=true
   ```
4. Rebuild e reenvio da pasta estática `out/` (a versão que você publica).

O que o SQL faz:
- Adiciona a coluna **`owner`** (dono) em `transactions`, `cartoes`, `app_settings` e `audit_log`.
- Liga a **Row Level Security** (cada usuário só vê/edita as próprias linhas).
- Cria **trigger** que preenche `owner` automaticamente ao inserir.
- Revoga acesso de usuários **anônimos** (só quem fez login acessa dados).
- O **primeiro login** "adota" as linhas antigas sem dono (migração automática dos dados existentes).

> ⚠️ Enquanto isso **não** for feito, o app continua funcionando no modo atual (sem login obrigatório e sem isolamento RLS), mas as proteções de servidor ficam inertes.

---

## 📁 Arquivos novos/criados nesta sessão

| Arquivo | O que é |
|---|---|
| `lib/format.js` | Formatação compartilhada (currency/date/parse) |
| `lib/security.js` | (reescrito) PBKDF2 + salt por dispositivo |
| `lib/auth.js` | Autenticação Supabase (entrar/criar conta/sair) |
| `lib/audit.js` | Registro de histórico de alterações |
| `components/AuthScreen.js` | Tela de login/cadastro |
| `components/AuditLogViewer.js` | Lista do histórico na Config |
| `supabase/rls.sql` | Migração: owner + RLS + trigger + audit_log |
