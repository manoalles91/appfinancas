/**
 * FinCasal v2.0 — App de Finanças Compartilhado
 * Pure JS (no framework) — localStorage persistence
 */
(function () {
    'use strict';

    // ===== AUTH =====
    const AUTH_KEY = 'fincasal_auth';
    function checkAuth() {
        if (sessionStorage.getItem(AUTH_KEY) === 'ok') { document.getElementById('loginOverlay').classList.add('hidden'); return true; }
        return false;
    }
    function setupLogin() {
        if (checkAuth()) return;
        document.getElementById('formLogin').addEventListener('submit', e => {
            e.preventDefault();
            const v = document.getElementById('inputSenha').value;
            if (v === 'alke123') { sessionStorage.setItem(AUTH_KEY, 'ok'); document.getElementById('loginOverlay').classList.add('hidden'); }
            else { document.getElementById('loginError').classList.remove('hidden'); document.getElementById('inputSenha').value = ''; document.getElementById('inputSenha').focus(); }
        });
    }

    // ===== SUPABASE CONFIG =====
    const supabaseUrl = 'https://nwdzrntbmiwaauauwgpga.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZHpybnRibWl3YWF1YXV3cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjI2OTksImV4cCI6MjA4ODYzODY5OX0.7Mr3jd_Rz_Cp-ADi54z26B4ESxItsyQ05DIJLEqjfNc';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const KEYS = { theme: 'fc_theme' };
    const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

    // ===== STATE =====
    let transacoes = [];
    let cartoes = [];
    let config = { limite: 3000, webhookUrl: '' };
    let categorias = {
        'Essenciais': ['Moradia', 'Luz', 'Água', 'Internet', 'Alimentação', 'Transporte', 'Saúde'],
        'Estilo de Vida': ['Lazer', 'Streaming', 'Vestuário', 'Pet', 'Educação', 'Doações/Presentes', 'Padaria', 'iFood'],
        'Investimentos': ['Poupança', 'Renda Fixa', 'Ações', 'Crypto', 'Previdência']
    };
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let currentFilter = 'Todos';
    let editingId = null;

    // ===== HELPERS =====
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const fmt = v => 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtSign = v => (v >= 0 ? '+' : '-') + ' ' + fmt(v);
    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 2500); };
    const parseValor = str => { const s = str.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.'); return parseFloat(s) || 0; };
    const formatInput = el => {
        let v = el.value.replace(/\D/g, '');
        v = (parseInt(v || 0) / 100).toFixed(2);
        el.value = v.replace('.', ',');
    };

    async function saveAll() {
        // Local fallback
        save('fc_transacoes', transacoes);
        save('fc_cartoes', cartoes);
        save('fc_categorias', categorias);
        save('fc_config', config);

        // Sync via Supabase Upsert Background
        if (transacoes.length > 0) supabase.from('transacoes').upsert(transacoes).then(r => r.error && console.error('Supabase TX Err:', r.error));
        if (cartoes.length > 0) supabase.from('cartoes').upsert(cartoes).then(r => r.error && console.error('Supabase Cartoes Err:', r.error));
        supabase.from('categorias').upsert({ id: 'unico', dados: categorias }).then(r => r.error && console.error('Supabase Cat Err:', r.error));
        supabase.from('config').upsert({ id: 'unico', limite: config.limite, webhookUrl: config.webhookUrl }).then(r => r.error && console.error('Supabase Config Err:', r.error));
    }

    function getMonthTransactions(m, y) {
        return transacoes.filter(t => {
            const d = new Date(t.data + 'T12:00:00');
            return d.getMonth() === m && d.getFullYear() === y;
        });
    }

    // ===== NAVIGATION =====
    window.FC = {};
    FC.goTo = page => {
        $$('.page').forEach(p => p.classList.remove('active'));
        $(page).classList.add('active');
        $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
        if (page === 'pageHome') refreshDashboard();
        if (page === 'pageCartoes') refreshCartoes();
        if (page === 'pageConfig') refreshConfig();
        if (page === 'pageNovo') resetForm();
    };

    // ===== THEME =====
    function initTheme() {
        const t = load(KEYS.theme) || 'dark';
        document.documentElement.setAttribute('data-theme', t);
        updateThemeIcons(t);
    }
    function toggleTheme() {
        const curr = document.documentElement.getAttribute('data-theme');
        const next = curr === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        save(KEYS.theme, next);
        updateThemeIcons(next);
    }
    function updateThemeIcons(t) {
        const icon = t === 'dark' ? '🌙' : '☀️';
        if ($('btnTheme')) $('btnTheme').textContent = icon;
        if ($('btnTheme2')) $('btnTheme2').textContent = icon;
    }

    // ===== TAB STATE =====
    let currentTabList = 'todas'; // todas | pagas | pendentes

    FC.filterByTab = (tabStr) => {
        currentTabList = tabStr;
        $$('.list-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabStr));
        refreshDashboard();
    };

    // ===== DASHBOARD =====
    function refreshDashboard() {
        generateRecurring(new Date(currentYear, currentMonth + 1, 0));
        const txs = getMonthTransactions(currentMonth, currentYear);
        $('lblMonth').textContent = `${MESES[currentMonth]} ${currentYear}`;

        // 1. Receitas do Mês (Pagas)
        const receitasPagas = txs.filter(t => t.tipo === 'receita' && !t.pendente)
            .reduce((acc, current) => acc + current.valor, 0);

        // 2. Receitas Totais Projetadas (Pagas + Pendentes)
        const receitasTotal = txs.filter(t => t.tipo === 'receita')
            .reduce((acc, current) => acc + current.valor, 0);

        // 3. Despesas Totais Projetadas (Pagas + Pendentes)
        const despesasTotal = txs.filter(t => t.tipo === 'despesa')
            .reduce((acc, current) => acc + current.valor, 0);

        // 4. Saldo Livre Projetado
        const saldoLivre = receitasTotal - despesasTotal;

        // 5. Categorias: Essenciais, Estilo de Vida e Investimentos
        let essencialGasto = 0, estiloGasto = 0, investGasto = 0;

        txs.filter(t => t.tipo === 'despesa').forEach(t => {
            if (categorias['Essenciais']?.includes(t.categoria)) {
                essencialGasto += t.valor;
            } else if (categorias['Estilo de Vida']?.includes(t.categoria)) {
                estiloGasto += t.valor;
            } else if (categorias['Investimentos']?.includes(t.categoria)) {
                investGasto += t.valor;
            }
        });

        // Definindo "Teto" provisório baseado na renda para simular o progresso do gráfico
        // Exemplo: 50% Essenciais, 30% Estilo de Vida, 20% Investimentos
        const tetoEssenciais = receitasTotal > 0 ? receitasTotal * 0.50 : 2000;
        const tetoEstilo = receitasTotal > 0 ? receitasTotal * 0.30 : 1000;
        const tetoInvest = receitasTotal > 0 ? receitasTotal * 0.20 : 500;

        const percEssenciais = tetoEssenciais > 0 ? Math.min((essencialGasto / tetoEssenciais) * 100, 100) : 0;
        const percEstilo = tetoEstilo > 0 ? Math.min((estiloGasto / tetoEstilo) * 100, 100) : 0;
        const percInvest = tetoInvest > 0 ? Math.min((investGasto / tetoInvest) * 100, 100) : 0;

        // Atualizar HTML - Topological
        $('dashReceitas').textContent = fmt(receitasPagas);

        $('valEssenciais').textContent = `${fmt(essencialGasto)} / ${fmt(tetoEssenciais)}`;
        $('lblEssenciais').textContent = `${percEssenciais.toFixed(0)}%`;
        $('barEssenciais').style.width = `${percEssenciais}%`;

        $('valEstiloVida').textContent = `${fmt(estiloGasto)} / ${fmt(tetoEstilo)}`;
        $('lblEstiloVida').textContent = `${percEstilo.toFixed(0)}%`;
        $('barEstiloVida').style.width = `${percEstilo}%`;

        if ($('valInvestimentos')) {
            $('valInvestimentos').textContent = `${fmt(investGasto)} / ${fmt(tetoInvest)}`;
            $('lblInvestimentos').textContent = `${percInvest.toFixed(0)}%`;
            $('barInvestimentos').style.width = `${percInvest}%`;
        }

        // Renderizar pills de subcategorias
        const catsTotals = {};
        txs.filter(t => t.tipo === 'despesa').forEach(t => {
            const c = t.categoria || 'Geral';
            catsTotals[c] = (catsTotals[c] || 0) + t.valor;
        });

        const renderPill = (catName) => {
            const total = catsTotals[catName] || 0;
            return total > 0 ? `<span class="subcat-pill">${catName} <strong>${fmt(total)}</strong></span>` : '';
        };

        if ($('pillsEssenciais')) {
            $('pillsEssenciais').innerHTML = (categorias['Essenciais'] || []).map(renderPill).join('');
        }
        if ($('pillsEstiloVida')) {
            $('pillsEstiloVida').innerHTML = (categorias['Estilo de Vida'] || []).map(renderPill).join('');
        }
        if ($('pillsInvestimentos')) {
            $('pillsInvestimentos').innerHTML = (categorias['Investimentos'] || []).map(renderPill).join('');
        }

        $('dashSaldoLivre').textContent = fmt(saldoLivre);
        if (saldoLivre < 0) {
            $('dashSaldoLivre').style.color = '#ef5350';
        } else {
            $('dashSaldoLivre').style.color = '#a5d6a7';
        }

        // Pending Alert Box
        let pending = 0, pendTotal = 0;
        txs.forEach(t => {
            if (t.tipo === 'despesa' && t.pendente) {
                pending++;
                pendTotal += t.valor;
            }
        });

        if (pending > 0) {
            $('pendingCard').classList.remove('hidden');
            $('pendingCount').textContent = pending;
            $('pendingTotal').textContent = fmt(pendTotal);
        } else {
            $('pendingCard').classList.add('hidden');
        }

        // Limit alert
        const despCom = txs.filter(t => t.tipo === 'despesa' && !t.pendente && t.quem === 'Comum').reduce((s, t) => s + t.valor, 0);
        if ($('alertBar')) {
            if (despCom > config.limite) { $('alertBar').classList.remove('hidden'); }
            else { $('alertBar').classList.add('hidden'); }
        }

        // List Render
        renderRecent(txs);
    }

    function renderRecent(txs) {
        // Filtragem Combinada (Pessoa + Aba de Status)
        let filtered = currentFilter === 'Todos' ? txs : txs.filter(t => t.quem === currentFilter);

        if (currentTabList === 'pagas') {
            filtered = filtered.filter(t => !t.pendente);
        } else if (currentTabList === 'pendentes') {
            filtered = filtered.filter(t => t.pendente);
        }

        const sorted = [...filtered].sort((a, b) => new Date(b.data) - new Date(a.data));
        const list = $('recentList');
        const empty = $('emptyState');

        if (sorted.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        // TAGGED LIST RENDERING
        let html = '';

        sorted.forEach(t => {
            const d = new Date(t.data + 'T12:00:00');
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const isIncome = t.tipo === 'receita';

            // Determine Macro Category for coloring
            let cat = t.categoria || 'Outros';
            let macro = 'Outros';
            if (isIncome) macro = 'Receitas';
            else if (categorias['Essenciais']?.includes(cat)) macro = 'Essenciais';
            else if (categorias['Estilo de Vida']?.includes(cat)) macro = 'Estilo de Vida';
            else if (categorias['Investimentos']?.includes(cat)) macro = 'Investimentos';

            const macroClass = macro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
            const subName = t.subcategoria || t.categoria || 'Geral';

            const statusBadge = t.pendente
                ? `<div class="status-badge pend" onclick="FC.togglePaid('${t.id}')">⏳ Pendente</div>`
                : `<div class="status-badge paid" onclick="FC.togglePaid('${t.id}')">✅ Pago</div>`;

            const quemIcon = t.quem === 'Eu' ? '👤' : t.quem === 'Esposa' ? '👩' : '🏠';

            html += `
                <div class="list-item" data-id="${t.id}">
                    <div class="list-item-header">
                        <div class="item-tags">
                            <span class="item-tag ${macroClass}">${macro}</span>
                            <span class="item-tag subcat">${subName}</span>
                        </div>
                        <div class="item-actions">
                            <button onclick="FC.editEntry('${t.id}')" class="btn-act" title="Editar">✏️</button>
                            ${statusBadge}
                        </div>
                    </div>
                    
                    <div class="item-title-row">
                        <div class="item-desc">${t.descricao} <span class="ri-icon-sm">${quemIcon}</span></div>
                    </div>

                    <div class="list-item-footer">
                        <span class="item-date">${dateStr}</span>
                        <div class="item-val ${isIncome ? 'income' : 'expense'}">${fmt(t.valor)}</div>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    }

    // Chart has been removed from new design, no need to draw.
    function drawChart() { return; }

    FC.togglePaid = id => {
        const t = transacoes.find(x => x.id === id);
        if (t) {
            t.pendente = !t.pendente;
            saveAll();
            refreshDashboard();
            toast(t.pendente ? '⏳ Movido para pendentes!' : '✅ Marcado como pago!');
        }
    };

    FC.markPaid = id => {
        const t = transacoes.find(x => x.id === id);
        if (t) { t.pendente = false; saveAll(); refreshDashboard(); toast('✅ Marcado como pago!'); }
    };

    FC.markUnpaid = id => {
        const t = transacoes.find(x => x.id === id);
        if (t) { t.pendente = true; saveAll(); refreshDashboard(); toast('⏳ Marcado como pendente!'); }
    };

    FC.editEntry = id => {
        const t = transacoes.find(x => x.id === id);
        if (!t) return;

        // goTo pageNovo clears the form and editingId via resetForm(), so we must set editingId AFTER calling it!
        FC.goTo('pageNovo');
        editingId = id;
        if ($('btnDeleteEntry')) $('btnDeleteEntry').classList.remove('hidden');

        $('novoTitle').textContent = 'Editar Lançamento';
        // Fill form
        $$('.tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.t === t.tipo));
        $$('.quem-btn').forEach(b => b.classList.toggle('active', b.dataset.q === t.quem));
        $('fDesc').value = t.descricao;
        $('fValor').value = t.valor.toFixed(2).replace('.', ',');
        $('fData').value = t.data;
        $('fPendente').checked = t.pendente || false;
        if (t.destino) $('fDestino').value = t.destino;

        // Recurrence UI sync
        let rType = 'unico';
        if (t.recorrencia === 'fixa') rType = 'fixa';
        else if (t.recorrencia === 'parcelada') rType = 'parcelada';

        $$('input[name="recType"]').forEach(r => r.checked = (r.value === rType));
        if (rType === 'fixa') {
            $('fFixaPeriodo').value = t.periodo || 'mensal';
            $('lblRecorrencia').textContent = 'Fixa (recorrente) ▸';
            $('fixaFields').classList.remove('hidden');
        } else if (rType === 'parcelada') {
            $('lblRecorrencia').textContent = 'Parcelado ▸';
            $('parcelaFields').classList.remove('hidden');
        } else {
            $('lblRecorrencia').textContent = 'Não recorrente ▸';
            $('fixaFields').classList.add('hidden');
            $('parcelaFields').classList.add('hidden');
        }

        fillCategorias(t.categoria);
        setTimeout(() => {
            if (t.subcategoria) $('fSubcategoria').value = t.subcategoria;
            if (t.cartao) $('fCartao').value = t.cartao;
            toggleCartaoFields();
        }, 50);
    };

    FC.deleteEntry = id => {
        const t = transacoes.find(x => x.id === id);
        if (!t) return;

        const isRecurring = (t.recorrencia === 'gerada' || t.recorrencia === 'fixa' || t.recorrencia === 'parcelada');

        if (isRecurring) {
            window.tempDeleteData = {
                id,
                descricao: t.descricao,
                data: t.data,
                baseDesc: t.recorrencia === 'parcelada' ? t.descricao.replace(/ \(\d+\/\d+\)$/, '') : t.descricao
            };
            $('modalRecDelete').classList.remove('hidden');
            return;
        }

        if (!confirm('Excluir lançamento?')) return;
        executeDelete([id]);
    };

    function executeDelete(ids) {
        transacoes = transacoes.filter(x => !ids.includes(x.id));
        saveAll();
        refreshDashboard();
        toast('🗑️ Excluído');

        if (ids.length === 1) {
            supabase.from('transacoes').delete().eq('id', ids[0]).then();
        } else if (ids.length > 1) {
            supabase.from('transacoes').delete().in('id', ids).then();
        }
    }

    FC.deleteCurrentEntry = () => {
        if (!editingId) return;
        const idToDel = editingId;
        FC.goTo('pageHome');
        FC.deleteEntry(idToDel);
    };

    FC.confirmDeleteRec = choice => {
        FC.closeModal('modalRecDelete');
        const data = window.tempDeleteData;
        if (!data) return;

        let idsToDelete = [];

        if (choice === 'onlyThis') {
            idsToDelete.push(data.id);
        } else if (choice === 'allFuture') {
            const future = transacoes.filter(x => x.descricao.startsWith(data.baseDesc) && x.data >= data.data);
            idsToDelete = future.map(x => x.id);

            const parentFixa = transacoes.find(x => x.recorrencia === 'fixa' && x.descricao === data.descricao && x.data <= data.data);
            if (parentFixa && !idsToDelete.includes(parentFixa.id)) {
                parentFixa.recorrencia = 'unico';
                supabase.from('transacoes').upsert({ id: parentFixa.id, recorrencia: 'unico' }).then();
                saveAll();
            }
        } else if (choice === 'all') {
            const all = transacoes.filter(x => x.descricao.startsWith(data.baseDesc));
            idsToDelete = all.map(x => x.id);
        }

        if (idsToDelete.length > 0) {
            executeDelete(idsToDelete);
        }
        window.tempDeleteData = null;
    };

    FC.confirmEditRec = choice => {
        window.recEditChoice = choice;
        FC.closeModal('modalRecEdit');
        saveEntry();
    };

    // ===== CARTÕES =====
    function calcCartaoTotal() {
        let total = 0;
        cartoes.forEach(c => {
            const gastos = transacoes.filter(t => {
                const d = new Date(t.data + 'T12:00:00');
                return t.cartao === c.nome && t.tipo === 'despesa' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            }).reduce((s, t) => s + t.valor, 0);
            total += gastos;
        });
        return total;
    }

    function refreshCartoes() {
        $('lblMonthCartao').textContent = MESES[currentMonth];
        const list = $('cartoesList');
        const empty = $('emptyCartoes');

        if (cartoes.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        list.innerHTML = cartoes.map(c => {
            const txMonth = transacoes.filter(t => {
                const d = new Date(t.data + 'T12:00:00');
                return t.cartao === c.nome && t.tipo === 'despesa' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });
            const emAberto = txMonth.reduce((s, t) => s + t.valor, 0);
            const limDisp = c.limite - emAberto;
            const perc = Math.min(Math.round(emAberto / c.limite * 100), 100);
            const today = new Date().getDate();
            const isFechada = today > c.fechamento;
            const barColor = perc > 80 ? 'var(--red)' : perc > 50 ? 'var(--comum)' : 'var(--accent)';
            const logoClass = c.nome.toLowerCase().includes('nubank') ? 'nubank' : c.nome.toLowerCase().includes('inter') ? 'inter' : 'default';
            const initial = c.nome.charAt(0).toUpperCase();

            return `<div class="cartao-card">
                <div class="cc-header">
                    <div class="cc-logo ${logoClass}">${initial}</div>
                    <div class="cc-info"><h4>${c.nome}</h4><span>🏷️ ${c.bandeira}</span></div>
                    <div class="cc-actions"><button onclick="FC.deleteCartao('${c.id}')" title="Excluir">🗑️</button></div>
                </div>
                <div class="cc-body">
                    <div class="cc-limits">
                        <div class="cc-lim"><span class="cc-lim-label">Limite</span><span class="cc-lim-val">${fmt(c.limite)}</span></div>
                        <div class="cc-lim"><span class="cc-lim-label">Em aberto</span><span class="cc-lim-val open">${fmt(emAberto)}</span></div>
                        <div class="cc-lim"><span class="cc-lim-label">Lim. disponível</span><span class="cc-lim-val disp">${fmt(limDisp)}</span></div>
                    </div>
                    <div class="cc-progress"><div class="cc-progress-bar" style="width:${perc}%;background:${barColor}"></div></div>
                    <div class="cc-perc">${perc}%</div>
                    <div class="cc-dates">
                        <span>Conta<strong>Conta Corrente</strong></span>
                        <span>Fechamento<strong>${String(c.fechamento).padStart(2, '0')}/${MESES[currentMonth].slice(0, 3)}</strong></span>
                        <span>Vencimento<strong>${String(c.vencimento).padStart(2, '0')}/${MESES[currentMonth].slice(0, 3)}</strong></span>
                    </div>
                </div>
                <div class="cc-fatura">
                    <div class="cc-fat-info"><span>Fatura</span><strong>${fmt(emAberto)}</strong></div>
                    <div style="display:flex;gap:6px">
                        <button class="btn-sm" style="background:var(--bg3);color:var(--text);padding:6px 10px" onclick="FC.abrirFatura('${c.nome}')" title="Ver Detalhes">🧾</button>
                        <button class="btn-sm" style="background:var(--bg3);color:var(--text);padding:6px 10px" onclick="FC.reajusteRapido('${c.nome}', ${emAberto})" title="Reajustar Fatura">⚖️ Reajuste</button>
                        <button class="btn-sm" style="padding:6px 10px" onclick="FC.addDespesaCartao('${c.nome}')" title="Lançar Despesa">➕ Lançar</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    FC.deleteCartao = id => {
        if (!confirm('Excluir cartão?')) return;
        cartoes = cartoes.filter(c => c.id !== id);
        saveAll(); refreshCartoes(); toast('🗑️ Cartão excluído');
        supabase.from('cartoes').delete().eq('id', id).then();
    };

    let cartaoFaturaAtual = null;

    FC.abrirFatura = nome => {
        cartaoFaturaAtual = nome;
        const txMonth = transacoes.filter(t => {
            const d = new Date(t.data + 'T12:00:00');
            return t.cartao === nome && t.tipo === 'despesa' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).sort((a, b) => new Date(b.data) - new Date(a.data));

        const total = txMonth.reduce((s, t) => s + t.valor, 0);

        $('mfTitle').textContent = `Fatura: ${nome}`;
        $('mfTotal').textContent = fmt(total);

        const list = $('mfList');
        if (txMonth.length === 0) {
            list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Nenhuma despesa nesta fatura</div>';
        } else {
            list.innerHTML = txMonth.map(t => {
                const d = new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                return `<div class="fatura-item">
                    <div class="fatura-info">
                        <span class="fatura-desc">${t.descricao}</span>
                        <span class="fatura-date">${d} • ${t.quem}</span>
                    </div>
                    <span class="fatura-val">${fmt(t.valor)}</span>
                    <div class="fatura-actions">
                        <button onclick="FC.deleteEntryFatura('${t.id}')">🗑️</button>
                    </div>
                </div>`;
            }).join('');
        }

        $('mfAjusteDesc').value = '';
        $('mfAjusteValor').value = '';
        $('modalFatura').classList.remove('hidden');
    };

    FC.deleteEntryFatura = id => {
        if (!confirm('Excluir lançamento da fatura?')) return;
        transacoes = transacoes.filter(x => x.id !== id);
        saveAll();
        FC.abrirFatura(cartaoFaturaAtual);
        refreshCartoes();
        toast('🗑️ Excluído');
    };

    FC.addAjusteFatura = () => {
        const desc = $('mfAjusteDesc').value.trim();
        const valor = parseValor($('mfAjusteValor').value);
        if (!desc || !valor) { toast('⚠️ Preencha descrição e valor'); return; }

        const yearBase = currentYear;
        const monthBase = String(currentMonth + 1).padStart(2, '0');
        const data = `${yearBase}-${monthBase}-01`;

        transacoes.push({
            id: uid(), descricao: desc, valor, data, tipo: 'despesa', quem: 'Comum',
            categoria: 'Essenciais', subcategoria: 'Ajuste Fatura', destino: 'Cartoes',
            pendente: false, cartao: cartaoFaturaAtual, recorrencia: 'unico'
        });

        saveAll();
        FC.abrirFatura(cartaoFaturaAtual);
        refreshCartoes();
        refreshDashboard();
        toast('✅ Ajuste adicionado');
    };

    FC.reajusteRapido = (nome, currentTotal) => {
        const input = prompt(`O valor atual da fatura no app é ${fmt(currentTotal)}.\nQual o valor exato da fatura no seu banco?`);
        if (!input) return;
        const bancoReal = parseValor(input);
        if (bancoReal <= 0) return;

        const diff = bancoReal - currentTotal;
        if (diff === 0) { toast('⚠️ Valores já estão iguais'); return; }

        const yearBase = currentYear;
        const monthBase = String(currentMonth + 1).padStart(2, '0');
        const data = `${yearBase}-${monthBase}-01`;

        transacoes.push({
            id: uid(),
            descricao: diff > 0 ? 'Encargos / Reajuste (Fatura)' : 'Estorno / Desconto (Fatura)',
            valor: Math.abs(diff),
            data,
            tipo: diff > 0 ? 'despesa' : 'receita',
            quem: 'Comum',
            categoria: 'Essenciais',
            subcategoria: 'Ajuste Fatura',
            destino: 'Cartoes',
            pendente: false,
            cartao: nome,
            recorrencia: 'unico'
        });

        saveAll();
        refreshCartoes();
        refreshDashboard();
        toast('✅ Fatura reajustada!');
    };

    FC.pagarFatura = () => {
        if (!confirm(`Atenção: Ao clicar em OK, o registro será mantido. Você pode conferir os gastos como pagos a qualquer momento.`)) return;
        toast('✅ Pagamento registrado visualmente!');
        FC.closeModal('modalFatura');
    };

    FC.addDespesaCartao = nome => {
        FC.goTo('pageNovo');
        setTimeout(() => {
            $('fDestino').value = 'Cartoes';
            toggleCartaoFields();
            $('fCartao').value = nome;
        }, 50);
    };

    FC.closeModal = id => $(id).classList.add('hidden');

    FC.prevMonthCartao = () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } refreshCartoes(); refreshDashboard(); };
    FC.nextMonthCartao = () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } refreshCartoes(); refreshDashboard(); };

    FC.showPendentes = () => {
        const pends = transacoes.filter(t => t.pendente);
        const list = $('pendentesList');
        list.innerHTML = pends.map(t => {
            const d = new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR');
            return `<div class="pend-item">
                <div class="pend-info"><span class="pend-desc">${t.descricao}</span><span class="pend-meta">${d} • ${t.quem}</span></div>
                <span class="pend-val">${fmt(t.valor)}</span>
                <button class="pend-btn" onclick="FC.markPaid('${t.id}');FC.showPendentes()">Pagar</button>
            </div>`;
        }).join('') || '<p style="text-align:center;color:var(--text3);padding:20px">Nenhuma pendência 🎉</p>';
        $('modalPendentes').classList.remove('hidden');
    };

    // ===== FORM: NOVO LANÇAMENTO =====
    function resetForm() {
        editingId = null;
        $('novoTitle').textContent = 'Nova Despesa';
        if ($('btnDeleteEntry')) $('btnDeleteEntry').classList.add('hidden');
        $('fDesc').value = '';
        $('fValor').value = '';
        $('fData').value = new Date().toISOString().split('T')[0];
        $('fPendente').checked = false;
        $$('.tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.t === 'despesa'));
        $$('.quem-btn').forEach(b => b.classList.toggle('active', b.dataset.q === 'Eu'));
        $$('input[name="recType"]')[0].checked = true;
        $('panelRecorrencia').classList.add('hidden');
        $('parcelaFields').classList.add('hidden');
        $('fixaFields').classList.add('hidden');
        $('lblRecorrencia').textContent = 'Não recorrente ▸';
        fillCategorias();
        fillCartaoSelect();
    }

    function fillCategorias(selectedCat) {
        const sel = $('fCategoria');
        const tipo = document.querySelector('.tipo-btn.active')?.dataset.t || 'despesa';

        // Garante que "Receitas" exista na inicialização
        if (!categorias['Receitas']) {
            categorias['Receitas'] = ['Salário', 'Rendimentos', 'Vendas', 'Cashback', 'Outros'];
        }

        let catsObj = Object.keys(categorias);
        if (tipo === 'receita') {
            catsObj = ['Receitas', 'Outros'];
        } else {
            catsObj = catsObj.filter(c => c !== 'Receitas');
        }

        sel.innerHTML = catsObj.map(c => `<option value="${c}" ${c === selectedCat ? 'selected' : ''}>${c}</option>`).join('');
        fillSubcategorias();
    }

    function fillSubcategorias() {
        const cat = $('fCategoria').value;
        const subs = categorias[cat] || [];
        $('fSubcategoria').innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    function fillCartaoSelect() {
        const sel = $('fCartao');
        sel.innerHTML = cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('') || '<option value="">Nenhum cadastrado</option>';
        toggleCartaoFields();
    }

    function toggleCartaoFields() {
        const dest = $('fDestino').value;
        $('cartaoFields').classList.toggle('hidden', dest !== 'Cartoes');
    }

    function saveEntry() {
        const desc = $('fDesc').value.trim();
        const valor = parseValor($('fValor').value);
        const data = $('fData').value;
        const tipo = document.querySelector('.tipo-btn.active')?.dataset.t || 'despesa';
        const quem = document.querySelector('.quem-btn.active')?.dataset.q || 'Eu';
        const cat = $('fCategoria').value;
        const subcat = $('fSubcategoria').value;
        const destino = $('fDestino').value;
        const pendente = $('fPendente').checked;
        const cartao = destino === 'Cartoes' ? $('fCartao').value : '';
        const recType = document.querySelector('input[name="recType"]:checked')?.value || 'unico';

        if (!desc || !valor) { toast('⚠️ Preencha descrição e valor'); return; }

        if (editingId) {
            const idx = transacoes.findIndex(t => t.id === editingId);
            if (idx >= 0) {
                const t = transacoes[idx];
                const isRecurring = (t.recorrencia === 'gerada' || t.recorrencia === 'fixa');

                if (isRecurring && !window.recEditChoice) {
                    window.tempEditData = { desc, valor, data, tipo, quem, cat, subcat, destino, pendente, cartao, recType, periodo: $('fFixaPeriodo').value };
                    FC.openModal('modalRecEdit');
                    return;
                }

                if (window.recEditChoice === 'allFuture') {
                    const d = window.tempEditData;
                    const oldFixa = transacoes.find(x => x.recorrencia === 'fixa' && x.descricao === t.descricao && x.data <= t.data);
                    if (oldFixa && oldFixa.id !== t.id) { oldFixa.recorrencia = 'unico'; supabase.from('transacoes').upsert({ id: oldFixa.id, recorrencia: 'unico' }).then(); }

                    const fGeradas = transacoes.filter(x => x.recorrencia === 'gerada' && x.descricao === t.descricao && x.data > t.data);
                    const delIds = fGeradas.map(x => x.id);
                    transacoes = transacoes.filter(x => !delIds.includes(x.id));
                    if (delIds.length > 0) supabase.from('transacoes').delete().in('id', delIds).then();

                    Object.assign(t, { descricao: d.desc, valor: d.valor, data: d.data, tipo: d.tipo, quem: d.quem, categoria: d.cat, subcategoria: d.subcat, destino: d.destino, pendente: d.pendente, cartao: d.cartao, recorrencia: 'fixa', periodo: d.periodo || t.periodo || 'mensal' });
                } else if (window.recEditChoice === 'onlyThis') {
                    const d = window.tempEditData;
                    if (t.recorrencia === 'fixa') {
                        const nextD = new Date(t.data + 'T12:00:00');
                        if (t.periodo === 'mensal') nextD.setMonth(nextD.getMonth() + 1);
                        else nextD.setFullYear(nextD.getFullYear() + 1);
                        const nxDStr = nextD.toISOString().split('T')[0];
                        transacoes.push({ id: uid(), descricao: t.descricao, valor: t.valor, data: nxDStr, tipo: t.tipo, quem: t.quem, categoria: t.categoria, subcategoria: t.subcategoria, destino: t.destino, pendente: true, cartao: t.cartao, recorrencia: 'fixa', periodo: t.periodo });
                        t.recorrencia = 'gerada';
                    }
                    Object.assign(t, { descricao: d.desc, valor: d.valor, data: d.data, tipo: d.tipo, quem: d.quem, categoria: d.cat, subcategoria: d.subcat, destino: d.destino, pendente: d.pendente, cartao: d.cartao });
                } else {
                    const updateObj = { descricao: desc, valor, data, tipo, quem, categoria: cat, subcategoria: subcat, destino, pendente, cartao, recorrencia: recType };
                    if (recType === 'fixa') updateObj.periodo = $('fFixaPeriodo').value;
                    Object.assign(transacoes[idx], updateObj);
                }
            }
            editingId = null;
            window.recEditChoice = null;
            window.tempEditData = null;
            toast('✅ Lançamento atualizado');
        } else if (recType === 'parcelada') {
            const qtd = parseInt($('fParcelaQtd').value) || 2;
            const inicio = parseInt($('fParcelaInicio').value) || 1;
            const periodo = $('fParcelaPeriodo').value;
            for (let i = 0; i < qtd; i++) {
                const d = new Date(data + 'T12:00:00');
                if (periodo === 'mensal') d.setMonth(d.getMonth() + i);
                else if (periodo === 'semanal') d.setDate(d.getDate() + (i * 7));
                else if (periodo === 'semestral') d.setMonth(d.getMonth() + (i * 6));
                else if (periodo === 'anual') d.setFullYear(d.getFullYear() + i);
                transacoes.push({
                    id: uid(), descricao: `${desc} (${inicio + i}/${inicio + qtd - 1})`, valor, data: d.toISOString().split('T')[0],
                    tipo, quem, categoria: cat, subcategoria: subcat, destino, pendente: true, cartao, recorrencia: 'parcelada'
                });
            }
            toast(`✅ ${qtd} parcelas criadas`);
        } else if (recType === 'fixa') {
            const periodo = $('fFixaPeriodo').value;
            transacoes.push({ id: uid(), descricao: desc, valor, data, tipo, quem, categoria: cat, subcategoria: subcat, destino, pendente, cartao, recorrencia: 'fixa', periodo });
            toast('✅ Despesa fixa criada');
        } else {
            transacoes.push({ id: uid(), descricao: desc, valor, data, tipo, quem, categoria: cat, subcategoria: subcat, destino, pendente, cartao, recorrencia: 'unico' });
            toast('✅ Lançamento salvo');
        }

        saveAll();
        generateRecurring();
        refreshDashboard();
        FC.goTo('pageHome');
    }

    // ===== CONFIG =====
    function refreshConfig() {
        // Categorias
        const catList = $('catList');
        catList.innerHTML = Object.keys(categorias).map(c =>
            `<div class="cfg-item"><span class="cfg-item-name">📂 ${c}</span><button onclick="FC.deleteCat('${c}')">Excluir</button></div>`
        ).join('');

        // Filter for subcats
        const filter = $('cfgCatFilter');
        filter.innerHTML = Object.keys(categorias).map(c => `<option value="${c}">${c}</option>`).join('');
        refreshSubcatList();

        // Fixas
        const fixas = transacoes.filter(t => t.recorrencia === 'fixa');
        $('fixasList').innerHTML = fixas.map(t =>
            `<div class="cfg-item"><span class="cfg-item-name">📌 ${t.descricao} (${fmt(t.valor)} - ${t.periodo})</span><button onclick="FC.deleteEntry('${t.id}');FC.goTo('pageConfig')">Excluir</button></div>`
        ).join('') || '<p style="text-align:center;color:var(--text3);font-size:.85rem;padding:8px">Nenhuma despesa fixa</p>';

        // Values
        $('cfgLimite').value = config.limite.toFixed(2).replace('.', ',');
        $('cfgWebhook').value = config.webhookUrl || '';
    }

    function refreshSubcatList() {
        const cat = $('cfgCatFilter').value;
        const subs = categorias[cat] || [];
        $('subCatList').innerHTML = subs.map(s =>
            `<div class="cfg-item"><span class="cfg-item-name">📁 ${s}</span><button onclick="FC.deleteSubcat('${cat}','${s}')">Excluir</button></div>`
        ).join('') || '<p style="text-align:center;color:var(--text3);font-size:.85rem;padding:8px">Nenhuma subcategoria</p>';
    }

    FC.addCategoriaPrompt = () => {
        const name = prompt('Nome da nova categoria:');
        if (!name || name.trim() === '') return;
        if (categorias[name.trim()]) { toast('⚠️ Categoria já existe'); return; }
        categorias[name.trim()] = [];
        saveAll();
        if ($('pageConfig').classList.contains('active')) refreshConfig();
        fillCategorias();
        toast('✅ Categoria adicionada');
    };

    FC.addSubcategoriaPrompt = () => {
        const cat = $('fCategoria')?.value || $('cfgCatFilter')?.value || Object.keys(categorias)[0];
        const name = prompt(`Nova subcategoria em "${cat}":`);
        if (!name || name.trim() === '') return;
        if (!categorias[cat]) categorias[cat] = [];
        if (categorias[cat].includes(name.trim())) { toast('⚠️ Já existe'); return; }
        categorias[cat].push(name.trim());
        saveAll();
        if ($('pageConfig').classList.contains('active')) refreshConfig();
        fillSubcategorias();
        toast('✅ Subcategoria adicionada');
    };

    FC.deleteCat = cat => {
        if (!confirm(`Excluir categoria "${cat}"?`)) return;
        delete categorias[cat];
        saveAll(); refreshConfig(); toast('🗑️ Categoria excluída');
    };

    FC.deleteSubcat = (cat, sub) => {
        if (!categorias[cat]) return;
        categorias[cat] = categorias[cat].filter(s => s !== sub);
        saveAll(); refreshConfig(); toast('🗑️ Subcategoria excluída');
    };

    // ===== WEBHOOK =====
    async function enviarParaN8N() {
        if (!config.webhookUrl) { toast('⚠️ Configure o webhook primeiro'); return; }
        const lastTx = transacoes[transacoes.length - 1];
        if (!lastTx) { toast('⚠️ Nenhuma transação para enviar'); return; }
        const payload = {
            Data: new Date(lastTx.data + 'T12:00:00').toLocaleDateString('pt-BR'),
            Descricao: lastTx.descricao,
            Categoria: lastTx.categoria,
            SubCategoria: lastTx.subcategoria,
            Valor: lastTx.valor.toFixed(2).replace('.', ','),
            Destino: lastTx.destino,
            Cartao: lastTx.cartao || '',
            QuemGastou: lastTx.quem,
            Tipo: lastTx.tipo === 'receita' ? 'Receita' : 'Despesa'
        };
        try {
            await fetch(config.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            toast('✅ Enviado para n8n!');
        } catch (err) { toast('❌ Erro ao enviar: ' + err.message); }
    }

    // ===== GENERATE FIXED ENTRIES =====
    function generateRecurring(targetDate) {
        // Look ahead 12 months to guarantee future visibility
        const limitDate = targetDate ? new Date(targetDate) : new Date();
        limitDate.setFullYear(limitDate.getFullYear() + 1);

        const fixas = transacoes.filter(t => t.recorrencia === 'fixa');
        fixas.forEach(template => {
            const p = (template.periodo || 'mensal').toLowerCase();
            const lastDate = new Date(template.data + 'T12:00:00');
            let nextDate = new Date(lastDate);

            // Advance one period for the first generation
            if (p === 'mensal') nextDate.setMonth(nextDate.getMonth() + 1);
            else if (p === 'semanal') nextDate.setDate(nextDate.getDate() + 7);
            else if (p === 'semestral') nextDate.setMonth(nextDate.getMonth() + 6);
            else if (p === 'anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
            else nextDate.setMonth(nextDate.getMonth() + 1); // fallback

            while (nextDate <= limitDate) {
                // Safeguard timezone format: build YYYY-MM-DD manually
                const yyyy = nextDate.getFullYear();
                const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
                const dd = String(nextDate.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;

                const exists = transacoes.some(t => t.descricao === template.descricao && t.data === dateStr && t.recorrencia !== 'fixa');

                if (!exists) {
                    transacoes.push({
                        id: uid(), descricao: template.descricao, valor: template.valor, data: dateStr,
                        tipo: template.tipo, quem: template.quem, categoria: template.categoria,
                        subcategoria: template.subcategoria, destino: template.destino, pendente: true,
                        cartao: template.cartao || '', recorrencia: 'gerada'
                    });
                }

                // Advance one period for next iteration
                const prevDate = nextDate.getDate();
                if (p === 'mensal') {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    if (nextDate.getDate() < prevDate) nextDate.setDate(0); // Fixes 31/01 to 28/02 skip bug
                }
                else if (p === 'semanal') nextDate.setDate(nextDate.getDate() + 7);
                else if (p === 'semestral') {
                    nextDate.setMonth(nextDate.getMonth() + 6);
                    if (nextDate.getDate() < prevDate) nextDate.setDate(0);
                }
                else if (p === 'anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
                else nextDate.setMonth(nextDate.getMonth() + 1); // fallback
            }
        });
        saveAll();
    }

    // ===== INIT =====
    function init() {
        setupLogin();
        initTheme();
        generateRecurring();

        // Nav
        $$('.nav-btn').forEach(b => b.addEventListener('click', () => FC.goTo(b.dataset.page)));

        // Month nav (Home)
        $('btnPrev').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } refreshDashboard(); });
        $('btnNext').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } refreshDashboard(); });

        // Theme
        $('btnTheme').addEventListener('click', toggleTheme);
        $('btnTheme2').addEventListener('click', toggleTheme);
        $('btnSync').addEventListener('click', enviarParaN8N);

        // Filters
        $$('.pill').forEach(p => p.addEventListener('click', () => {
            $$('.pill').forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            currentFilter = p.dataset.f;
            refreshDashboard();
        }));

        // Form: tipo toggle
        $$('.tipo-btn').forEach(b => b.addEventListener('click', () => {
            $$('.tipo-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            $('novoTitle').textContent = b.dataset.t === 'receita' ? 'Nova Receita' : 'Nova Despesa';
            if (b.dataset.t === 'receita') $('fDestino').value = 'Receitas';
            fillCategorias();
        }));

        // Form: quem toggle
        $$('.quem-btn').forEach(b => b.addEventListener('click', () => {
            $$('.quem-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
        }));

        // Form: valor mask
        $('fValor').addEventListener('input', function () { formatInput(this); });

        // Form: recorrência
        $('rowRecorrencia').addEventListener('click', () => $('panelRecorrencia').classList.toggle('hidden'));
        $$('input[name="recType"]').forEach(r => r.addEventListener('change', () => {
            const v = document.querySelector('input[name="recType"]:checked').value;
            $('lblRecorrencia').textContent = v === 'unico' ? 'Não recorrente ▸' : v === 'parcelada' ? 'Parcelar ou repetir ▸' : 'Fixa (recorrente) ▸';
            $('parcelaFields').classList.toggle('hidden', v !== 'parcelada');
            $('fixaFields').classList.toggle('hidden', v !== 'fixa');
        }));

        // Form: categoria change
        $('fCategoria').addEventListener('change', fillSubcategorias);
        $('fDestino').addEventListener('change', toggleCartaoFields);

        // Form: quick cats
        $$('.qc').forEach(b => b.addEventListener('click', () => {
            const sub = b.dataset.c;
            // Find which category has this sub
            for (const [cat, subs] of Object.entries(categorias)) {
                if (subs.includes(sub)) { $('fCategoria').value = cat; fillSubcategorias(); break; }
            }
            setTimeout(() => { try { $('fSubcategoria').value = sub; } catch { } }, 30);
            $('fDesc').value = b.textContent.trim();
        }));

        // Save entry
        $('btnSaveEntry').addEventListener('click', saveEntry);
        $('btnN8N').addEventListener('click', enviarParaN8N);

        // Cartão: add
        $('btnAddCartao').addEventListener('click', () => $('modalCartao').classList.remove('hidden'));
        $('btnSaveCartao').addEventListener('click', () => {
            const nome = $('mcNome').value.trim();
            const bandeira = $('mcBandeira').value;
            const limite = parseValor($('mcLimite').value);
            const fechamento = parseInt($('mcFecha').value) || 3;
            const vencimento = parseInt($('mcVence').value) || 10;
            if (!nome || !limite) { toast('⚠️ Preencha nome e limite'); return; }
            cartoes.push({ id: uid(), nome, bandeira, limite, fechamento, vencimento });
            saveAll();
            $('modalCartao').classList.add('hidden');
            $('mcNome').value = ''; $('mcLimite').value = '';
            refreshCartoes(); fillCartaoSelect();
            toast('✅ Cartão cadastrado');
        });

        // Config: limit mask
        $('cfgLimite').addEventListener('input', function () { formatInput(this); });

        // Config: save limit
        $('btnSaveLimite').addEventListener('click', () => {
            config.limite = parseValor($('cfgLimite').value);
            saveAll(); toast('✅ Limite salvo');
        });

        // Config: save webhook
        $('btnSaveWebhook').addEventListener('click', () => {
            config.webhookUrl = $('cfgWebhook').value.trim();
            saveAll(); toast('✅ Webhook salvo');
        });

        // Config: sub cat filter
        $('cfgCatFilter').addEventListener('change', refreshSubcatList);

        // Config: import
        $('btnImport').addEventListener('click', () => $('cfgImportFile').click());
        $('cfgImportFile').addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.transacoes) transacoes = data.transacoes;
                    if (data.cartoes) cartoes = data.cartoes;
                    if (data.categorias) categorias = data.categorias;
                    if (data.config) config = Object.assign(config, data.config);
                    saveAll();
                    refreshConfig();
                    FC.goTo('pageHome');
                    toast('✅ Dados importados com sucesso!');
                } catch (err) {
                    toast('❌ Erro ao importar arquivo JSON');
                }
            };
            reader.readAsText(file);
        });

        // Config: export
        $('btnExport').addEventListener('click', () => {
            const data = { transacoes, cartoes, categorias, config };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `fincasal_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            toast('📤 Exportado!');
        });

        // Config: clear
        $('btnClear').addEventListener('click', () => {
            if (!confirm('⚠️ Limpar TODOS os dados? Isso é irreversível!')) return;
            transacoes = []; cartoes = []; config = { limite: 3000, webhookUrl: '' };
            categorias = { 'Essenciais': ['Moradia', 'Luz', 'Água', 'Internet', 'Alimentação', 'Transporte', 'Saúde'], 'Estilo de Vida': ['Lazer', 'Streaming', 'Vestuário', 'Pet', 'Educação', 'Doações/Presentes'], 'Investimentos': ['Poupança', 'Renda Fixa', 'Ações', 'Crypto', 'Previdência'] };
            saveAll(); FC.goTo('pageHome'); toast('🗑️ Dados limpos');
        });

        // Initial render
        $('fData').value = new Date().toISOString().split('T')[0];
    }

    async function initCloud() {
        // 1. Tentar pegar do localStorage primeiro para fallback
        const localTx = load('fc_transacoes');
        if (localTx && localTx.length > 0) transacoes = localTx;
        const localCx = load('fc_cartoes');
        if (localCx && localCx.length > 0) cartoes = localCx;
        const localCat = load('fc_categorias');
        if (localCat) categorias = localCat;
        const localConf = load('fc_config');
        if (localConf) config = Object.assign(config, localConf);

        try {
            if ($('novoTitle')) $('novoTitle').textContent = 'Carregando Dados... ⏳';
            const [rT, rC, rCat, rConf] = await Promise.all([
                supabase.from('transacoes').select('*'),
                supabase.from('cartoes').select('*'),
                supabase.from('categorias').select('dados').eq('id', 'unico').single(),
                supabase.from('config').select('*').eq('id', 'unico').single()
            ]);

            // Só substitui se o Supabase RETORNAR dados (não sobrescreve o local com vazio se a nuvem falhou)
            if (rT.data && rT.data.length > 0) transacoes = rT.data;
            if (rC.data && rC.data.length > 0) cartoes = rC.data;
            if (rCat.data && rCat.data.dados) categorias = rCat.data.dados;
            if (rConf.data) { config.limite = rConf.data.limite; config.webhookUrl = rConf.data.webhookurl || rConf.data.webhookUrl || ''; }

            // Atualiza o local com os dados frescos da nuvem
            save('fc_transacoes', transacoes);
            save('fc_cartoes', cartoes);
            save('fc_categorias', categorias);
            save('fc_config', config);

            if ($('novoTitle')) $('novoTitle').textContent = 'Nova Despesa';
        } catch (e) {
            console.log('Erro Supabase, mantendo dados locais', e);
            if ($('novoTitle')) $('novoTitle').textContent = 'Modo Offline (Erro Nuvem)';
        }

        init();
        fillCategorias();
        fillCartaoSelect();
        refreshDashboard();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCloud);
    else initCloud();
})();
