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

    // ===== STORAGE =====
    const KEYS = { data: 'fc_data', config: 'fc_config', cartoes: 'fc_cartoes', cats: 'fc_cats', theme: 'fc_theme' };
    const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

    // ===== STATE =====
    let transacoes = load(KEYS.data) || [];
    let cartoes = load(KEYS.cartoes) || [];
    let config = load(KEYS.config) || { limite: 3000, webhookUrl: '' };
    let categorias = load(KEYS.cats) || {
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

    function saveAll() {
        save(KEYS.data, transacoes);
        save(KEYS.cartoes, cartoes);
        save(KEYS.config, config);
        save(KEYS.cats, categorias);
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

    // ===== DASHBOARD =====
    function refreshDashboard() {
        const txs = getMonthTransactions(currentMonth, currentYear);
        $('lblMonth').textContent = `${MESES[currentMonth]} ${currentYear}`;

        // Calc
        let recEu = 0, recEsp = 0, recCom = 0, despEu = 0, despEsp = 0, despCom = 0;
        let recPrev = 0, despPrev = 0, pending = 0, pendTotal = 0;
        txs.forEach(t => {
            const v = t.valor;
            if (t.tipo === 'receita') {
                recPrev += v;
                if (!t.pendente) { if (t.quem === 'Eu') recEu += v; else if (t.quem === 'Esposa') recEsp += v; else { recEu += v / 2; recEsp += v / 2; recCom += v; } }
            } else {
                despPrev += v;
                if (!t.pendente) { if (t.quem === 'Eu') despEu += v; else if (t.quem === 'Esposa') despEsp += v; else { despEu += v / 2; despEsp += v / 2; despCom += v; } }
                if (t.pendente) { pending++; pendTotal += v; }
            }
        });

        const recAtual = recEu + recEsp + recCom;
        const despAtual = despEu + despEsp + despCom;
        const saldoEu = recEu - despEu;
        const saldoEsp = recEsp - despEsp;
        const saldoTotal = saldoEu + saldoEsp;

        $('saldoAtual').textContent = fmt(saldoTotal);
        $('saldoPrevisto').textContent = fmt(recPrev - despPrev);
        $('saldoInicial').textContent = fmt(0);
        $('ovReceitaAtual').textContent = fmt(recAtual);
        $('ovReceitaPrev').textContent = fmt(recPrev);
        $('ovDespesaAtual').textContent = fmt(despAtual);
        $('ovDespesaPrev').textContent = fmt(despPrev);

        // Cartões
        const cartaoTotal = calcCartaoTotal();
        $('ovCartoes').textContent = fmt(cartaoTotal);
        $('ovCartoesPrev').textContent = fmt(cartaoTotal);

        // Casal
        $('casalEu').textContent = fmt(saldoEu);
        $('casalEsposa').textContent = fmt(saldoEsp);
        $('casalTotal').textContent = fmt(saldoTotal);
        const totalFixa = txs.filter(t => t.tipo === 'despesa' && t.destino === 'Contas Fixas').reduce((s, t) => s + t.valor, 0);
        const euFixa = txs.filter(t => t.tipo === 'despesa' && t.destino === 'Contas Fixas' && t.quem === 'Eu').reduce((s, t) => s + t.valor, 0);
        $('contribEu').textContent = totalFixa ? Math.round(euFixa / totalFixa * 100) + '%' : '0%';
        $('contribEsposa').textContent = totalFixa ? Math.round((totalFixa - euFixa) / totalFixa * 100) + '%' : '0%';

        // Pending
        if (pending > 0) {
            $('pendingCard').classList.remove('hidden');
            $('pendingCount').textContent = pending;
            $('pendingTotal').textContent = fmt(pendTotal);
        } else { $('pendingCard').classList.add('hidden'); }

        // Limit alert
        if (despCom > config.limite) { $('alertBar').classList.remove('hidden'); }
        else { $('alertBar').classList.add('hidden'); }

        // Recent
        renderRecent(txs);
        drawChart(txs);
    }

    function renderRecent(txs) {
        const filtered = currentFilter === 'Todos' ? txs : txs.filter(t => t.quem === currentFilter);
        const sorted = [...filtered].sort((a, b) => new Date(b.data) - new Date(a.data));
        const list = $('recentList');
        const empty = $('emptyState');

        if (sorted.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        list.innerHTML = sorted.map(t => {
            const d = new Date(t.data + 'T12:00:00');
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const isIncome = t.tipo === 'receita';
            const quemIcon = t.quem === 'Eu' ? '👤' : t.quem === 'Esposa' ? '👩' : '🏠';
            const pending = t.pendente ? '<span class="ri-pending">PENDENTE</span>' : '';
            return `<div class="recent-item" data-id="${t.id}">
                <span class="ri-icon">${quemIcon}</span>
                <div class="ri-info"><span class="ri-desc">${t.descricao}${pending}</span><span class="ri-meta">${dateStr} • ${t.subcategoria || t.categoria}</span></div>
                <span class="ri-val ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${fmt(t.valor)}</span>
                <div class="ri-actions">
                    ${t.pendente ? `<button onclick="FC.markPaid('${t.id}')" title="Marcar pago">✅</button>` : ''}
                    <button onclick="FC.editEntry('${t.id}')" title="Editar">✏️</button>
                    <button onclick="FC.deleteEntry('${t.id}')" title="Excluir">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }

    function drawChart(txs) {
        const canvas = $('chartSaldo');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.offsetWidth;
        const h = 60;
        ctx.clearRect(0, 0, w, h);

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dailySaldo = Array(daysInMonth).fill(0);
        txs.forEach(t => {
            const d = new Date(t.data + 'T12:00:00').getDate() - 1;
            if (d >= 0 && d < daysInMonth) dailySaldo[d] += t.tipo === 'receita' ? t.valor : -t.valor;
        });
        let running = 0;
        const points = dailySaldo.map(v => { running += v; return running; });

        const maxV = Math.max(...points.map(Math.abs), 1);
        const pad = 8;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        points.forEach((p, i) => {
            const x = pad + (i / (daysInMonth - 1)) * (w - pad * 2);
            const y = h / 2 - (p / maxV) * (h / 2 - pad);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    FC.markPaid = id => {
        const t = transacoes.find(x => x.id === id);
        if (t) { t.pendente = false; saveAll(); refreshDashboard(); toast('✅ Marcado como pago!'); }
    };

    FC.editEntry = id => {
        const t = transacoes.find(x => x.id === id);
        if (!t) return;
        editingId = id;
        FC.goTo('pageNovo');
        $('novoTitle').textContent = 'Editar Lançamento';
        // Fill form
        $$('.tipo-btn').forEach(b => b.classList.toggle('active', b.dataset.t === t.tipo));
        $$('.quem-btn').forEach(b => b.classList.toggle('active', b.dataset.q === t.quem));
        $('fDesc').value = t.descricao;
        $('fValor').value = t.valor.toFixed(2).replace('.', ',');
        $('fData').value = t.data;
        $('fPendente').checked = t.pendente || false;
        if (t.destino) $('fDestino').value = t.destino;
        fillCategorias(t.categoria);
        setTimeout(() => { if (t.subcategoria) $('fSubcategoria').value = t.subcategoria; }, 50);
    };

    FC.deleteEntry = id => {
        if (!confirm('Excluir lançamento?')) return;
        transacoes = transacoes.filter(x => x.id !== id);
        saveAll(); refreshDashboard(); toast('🗑️ Excluído');
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
        sel.innerHTML = Object.keys(categorias).map(c => `<option value="${c}" ${c === selectedCat ? 'selected' : ''}>${c}</option>`).join('');
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
            if (idx >= 0) Object.assign(transacoes[idx], { descricao: desc, valor, data, tipo, quem, categoria: cat, subcategoria: subcat, destino, pendente, cartao });
            editingId = null;
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
    function generateRecurring() {
        const today = new Date();
        const fixas = transacoes.filter(t => t.recorrencia === 'fixa');
        fixas.forEach(template => {
            const lastDate = new Date(template.data + 'T12:00:00');
            let nextDate = new Date(lastDate);
            if (template.periodo === 'mensal') nextDate.setMonth(nextDate.getMonth() + 1);
            else if (template.periodo === 'semanal') nextDate.setDate(nextDate.getDate() + 7);
            else if (template.periodo === 'semestral') nextDate.setMonth(nextDate.getMonth() + 6);
            else if (template.periodo === 'anual') nextDate.setFullYear(nextDate.getFullYear() + 1);

            while (nextDate <= today) {
                const dateStr = nextDate.toISOString().split('T')[0];
                const exists = transacoes.some(t => t.descricao === template.descricao && t.data === dateStr && t.recorrencia !== 'fixa');
                if (!exists) {
                    transacoes.push({
                        id: uid(), descricao: template.descricao, valor: template.valor, data: dateStr,
                        tipo: template.tipo, quem: template.quem, categoria: template.categoria,
                        subcategoria: template.subcategoria, destino: template.destino, pendente: true,
                        cartao: template.cartao || '', recorrencia: 'gerada'
                    });
                }
                if (template.periodo === 'mensal') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (template.periodo === 'semanal') nextDate.setDate(nextDate.getDate() + 7);
                else if (template.periodo === 'semestral') nextDate.setMonth(nextDate.getMonth() + 6);
                else nextDate.setFullYear(nextDate.getFullYear() + 1);
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
        fillCategorias();
        fillCartaoSelect();
        refreshDashboard();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
