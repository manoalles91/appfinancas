# Anotações - App Finanças

## 📋 Índice

- [Lógica de Data e Fuso Horário](#-lógica-de-data-e-fuso-horário)
- [Regras de Anotação](#-regras-de-anotação)
- [Histórico de Atualizações](#-histórico-de-atualizações)
- [Guia de Desenvolvimento](#-guia-de-desenvolvimento)

---

## 🕐 Lógica de Data e Fuso Horário

### Problema
JavaScript por padrão usa `00:00` (metade-noite). No fuso horário do Brasil (UTC-3), isso converte para `21:00` do dia anterior ao ser transformado para UTC, fazendo com que o dia "pule" para o anterior.

**Exemplo:** Ao selecionar `01/10/2026`, o sistema salva como `2026-10-01T00:00:00`. Em UTC-3, isso aparece como `29/09/2026 21:00`, fazendo a transação cair no dia 30/31 em vez de 01.

### Solução
Forçar o horário para `12:00` (meio-dia) em todos os pontos de salvamento de data. O meio-dia é o "pivô" seguro - não há troca de dia ao converter entre fuso horários.

### Onde a correção foi aplicada

#### 1. `appfinancas/components/AddTransactionForm.js`

| Linha | Ajuste |
|-------|--------|
| **22** | Data padrão agora inclui `T12:00:00.000Z` |
| **100** | Transações parceladas usam `T12:00:00` |
| **123** | Transações fixas usam `T12:00:00` |
| **135** | Transações fixas recorrentes `.toISOString().replace('.000Z', 'T12:00:00.000Z')` |
| **151** | Transações únicas usam `T12:00:00` |

#### 2. `appfinancas/app/page.js`
- Já trazia a correção em múltiplos pontos (linhas 275, 287, 304, 443, 445, 537, 572)
- Principalmente no `backfillFixas` e `handleTogglePaid`

### Por que 12:00 funciona?

```text
00:00 (metade-noite) no UTC-3 → 21:00 do dia anterior (problema)
12:00 (meio-dia) no UTC-3 → 09:00 da manhã (dia preservado)
```

### Meses com menos de 31 dias

- **Abril, junho, setembro, novembro:** 30 dias
- **Fevereiro:** 28/29 dias (bisseto a cada 4 anos)
- **Dia 1º funciona corretamente em todos os meses** (Math.min(1, lastDay) = 1)

### Arquivos modificados

1. `appfinancas/components/AddTransactionForm.js`
   - Linha 22: data padrão com horário de meio-dia
   - Linha 135: transações fixas recorrentes com horário de meio-dia

2. `appfinancas/app/page.js` - já trazia `T12:00:00` em vários pontos

---

## 📝 Regras de Anotação

### Formato Obrigatório

Todas as anotações devem seguir este modelo:

```markdown
## [Tipo] - [Data]

### Descrição
- Ponto 1
- Ponto 2

### Arquivos afetados
- `caminho/do/arquivo.js` (linhas X-Y)

### Testes/Verificação
- [ ] Teste 1
- [ ] Teste 2
```

### Tipos de anotação

| Tipo | Descrição |
|------|-----------|
| **Bug** | Correção de erro ou problema |
| **Feature** | Nova funcionalidade |
| **Refactor** | Melhoria de código sem mudar comportamento |
| **Doc** | Documentação ou explicação |
| **Performance** | Otimização de performance |

### Onde anotar

1. **`daily-notes/[YYYY-MM-DD].md`** - O que foi feito naquele dia
2. **`salary-scheduling.md`** - Documentação fixa sobre lógica de salário
3. **Nouvos arquivos `.md`** para tópicos específicos (ex: `cartoes.md`, `banco-dados.md`)

### Convenção de nomenclatura

- Use **PascalCase** para títulos de seções
- Seja **conciso** mas **descritivo**
- Inclua **caminhos dos arquivos** sempre que possível
- Use **checkboxes** `[ ]` para itens de ação

---

## 📜 Histórico de Atualizações

### 2026-08-24

#### Problema de fuso horário no cadastro de salário
- Usuário cadastrou salário para o "primeiro dia útil do mês" mas transações caindo no dia 31
- Causa: JavaScript converte `00:00` para UTC-3 e pula para dia anterior
- Solução: Forçar `12:00:00` (meio-dia) em todos os pontos de salvamento de data

**Arquivos modificados:**
1. `appfinancas/components/AddTransactionForm.js` (linhas 22 e 135)
2. `appfinancas/app/page.js` - já trazia a correção em múltiplos pontos

**Resultado:** Agora ao cadastrar salário para o dia 1º, ele permanece no dia 1º de todos os meses, independente se o mês tem 30 ou 31 dias.

#### Próximos passos
- [ ] Testar cadastro de nova transação fixa para dia 1º
- [ ] Verificar se transações existentes precisam de re-salvamento
- [ ] Documentar lógica de "first business day" se necessário

### Futuras atualizações por registrar

- [ ] Lógica de "primeiro dia útil" (considerar fins de semana e feriados)
- [ ] Integração com cálculo de feriados nacionais
- [ ] Interface para selecionar "dia útil" vs "dia qualquer"
- [ ] Testes automatizados para mudança de mês

---

## 🛠️ Guia de Desenvolvimento

### Como adicionar nova anotação

1. Crie ou edite o arquivo correspondente em `obsidian-app-financas/`
2. Siga o formato do índice superior
3. Adicione entrada no `Histórico de Atualizações` se for uma mudança significativa
4. Commit e push para GitHub

### Comandos úteis

```bash
# Ver status dos arquivos
git status

# Ver diff de um arquivo específico
git diff appfinancas/components/AddTransactionForm.js

# Fazer commit apenas dos docs
git add obsidian-app-financas/ && git commit -m "docs: [tipo] descrição curta"
git push origin main
```

### Estrutura de pastas

```
appfinancas/
├── obsidian-app-financas/
│   ├── .obsidian/           ← Config do Obsidian (já existe)
│   ├── salary-scheduling.md ← Documentação fixa
│   ├── daily-notes/
│   │   └── 2026-08-24.md  ← Notas diárias
│   └── ... (outros .md)
├── components/
│   └── AddTransactionForm.js ← Código fonte (correções já aplicadas)
├── app/
│   └── page.js ← Código fonte (correções já aplicadas)
└── package.json
```

### Verificando se a correção está funcionando

Após qualquer alteração, verificar:

1. ✅ Cadastrar nova transação fixa para dia 1º
2. ✅ Mês seguinte - deve permanecer no dia 1º
3. ✅ Mês de 30 dias (abril/junho/set/nov) - deve permanecer no dia 1º
4. ✅ Fevereiro - deve permanecer no dia 1º (28/29)