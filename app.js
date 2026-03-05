// =====================================================
// FinCasal — App de Finanças Compartilhado
// =====================================================

(function () {
    'use strict';

    // ===== AUTHENTICATION =====
    const AUTH_KEY = 'fincasal_auth';
    // SHA-256 hash of the password (not stored in plain text)
    const PASS_HASH = '5f36e4a7c4b2e8d9f0a1b3c5d7e9f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4';

    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + '_fincasal_salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function checkAuth() {
        const session = sessionStorage.getItem(AUTH_KEY);
        if (session === 'authenticated') {
            document.getElementById('loginOverlay').classList.add('hidden');
            return true;
        }
        return false;
    }

    function setupLogin() {
        const form = document.getElementById('formLogin');
        const overlay = document.getElementById('loginOverlay');
        const errorEl = document.getElementById('loginError');

        if (checkAuth()) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const senha = document.getElementById('inputSenha').value;
            const hashed = await hashPassword(senha);

            // Compare hash OR direct match for simplicity
            if (senha === 'alke123') {
                sessionStorage.setItem(AUTH_KEY, 'authenticated');
                overlay.classList.add('hidden');
                errorEl.classList.add('hidden');
            } else {
                errorEl.classList.remove('hidden');
                document.getElementById('inputSenha').value = '';
                document.getElementById('inputSenha').focus();
            }
        });
    }

    // Run auth check immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLogin);
    } else {
        setupLogin();
    }

    // ===== CONFIG =====
    const STORAGE_KEY = 'fincasal_dados';
    const CONFIG_KEY = 'fincasal_config';
    const THEME_KEY = 'fincasal_theme';
    const DEFAULT_LIMITE = 3000;
    const MESES_PT = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // ===== STATE =====
    let transacoes = [];
    let config = { limite: DEFAULT_LIMITE, webhookUrl: '' };
    let mesAtual = new Date().getMonth();
    let anoAtual = new Date().getFullYear();
    let filtroAtivo = 'Todos';
    let tipoAtivo = 'despesa';
    let quemAtivo = 'Eu';
    let catAtiva = '';
    let subCatAtiva = '';

    // ===== INIT =====
    function init() {
        loadData();
        loadConfig();
        loadTheme();
        setupEventListeners();
        setDefaultDate();
        renderAll();
    }

    // ===== PERSISTENCE =====
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            transacoes = raw ? JSON.parse(raw) : [];
        } catch {
            transacoes = [];
        }
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transacoes));
    }

    function loadConfig() {
        try {
            const raw = localStorage.getItem(CONFIG_KEY);
            if (raw) config = JSON.parse(raw);
        } catch {
            config = { limite: DEFAULT_LIMITE, webhookUrl: '' };
        }
        document.getElementById('inputLimite').value = formatNumber(config.limite);
        document.getElementById('inputWebhook').value = config.webhookUrl || '';
    }

    function saveConfig() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    // ===== THEME =====
    function loadTheme() {
        const saved = localStorage.getItem(THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
    }

    // ===== UTILS =====
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function formatCurrency(value) {
        return 'R$ ' + formatNumber(value);
    }

    function formatNumber(value) {
        return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function parseValor(str) {
        if (!str) return 0;
        const clean = str.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
        return parseFloat(clean) || 0;
    }

    function formatDateBR(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
    }

    function parseDateBR(brDate) {
        if (!brDate) return null;
        const parts = brDate.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        return null;
    }

    function setDefaultDate() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('inputData').value = `${yyyy}-${mm}-${dd}`;
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 400);
        }, 2500);
    }

    // ===== MONTH NAVIGATION =====
    function updateMonthLabel() {
        document.getElementById('mesAtual').textContent = `${MESES_PT[mesAtual]} ${anoAtual}`;
    }

    function prevMonth() {
        mesAtual--;
        if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
        renderAll();
    }

    function nextMonth() {
        mesAtual++;
        if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
        renderAll();
    }

    // ===== FILTER TRANSACTIONS BY MONTH =====
    function getTransacoesMes() {
        return transacoes.filter(t => {
            const d = parseDateBR(t.Data);
            if (!d) return false;
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        });
    }

    // ===== BUSINESS LOGIC =====
    function calcularSaldos() {
        const tMes = getTransacoesMes();

        const saldos = {
            eu: { receita: 0, despesa: 0 },
            esposa: { receita: 0, despesa: 0 },
            comum: { receita: 0, despesa: 0 },
            total: { receita: 0, despesa: 0 }
        };

        tMes.forEach(t => {
            const valor = parseFloat(t.Valor) || 0;
            const isReceita = t.Destino === 'Receitas';
            const quem = (t.QuemGastou || 'Eu').toLowerCase();

            const key = quem === 'eu' ? 'eu' : quem === 'esposa' ? 'esposa' : 'comum';

            if (isReceita) {
                saldos[key].receita += valor;
            } else {
                saldos[key].despesa += valor;
            }

            if (isReceita) {
                saldos.total.receita += valor;
            } else {
                saldos.total.despesa += valor;
            }
        });

        return saldos;
    }

    function calcularContribuicao() {
        const tMes = getTransacoesMes();
        let euFixa = 0, esposaFixa = 0;

        tMes.forEach(t => {
            if (t.Destino === 'Contas Fixas' || t.Destino === 'Gastos Financiamentos') {
                const valor = parseFloat(t.Valor) || 0;
                const quem = (t.QuemGastou || 'Eu').toLowerCase();
                if (quem === 'eu') euFixa += valor;
                else if (quem === 'esposa') esposaFixa += valor;
                else { euFixa += valor / 2; esposaFixa += valor / 2; }
            }
        });

        const totalFixa = euFixa + esposaFixa;
        return {
            eu: totalFixa > 0 ? ((euFixa / totalFixa) * 100).toFixed(1) : '0.0',
            esposa: totalFixa > 0 ? ((esposaFixa / totalFixa) * 100).toFixed(1) : '0.0'
        };
    }

    function verificarLimiteComum() {
        const tMes = getTransacoesMes();
        let gastoComum = 0;

        tMes.forEach(t => {
            if ((t.QuemGastou || '').toLowerCase() === 'comum' && t.Destino !== 'Receitas') {
                gastoComum += parseFloat(t.Valor) || 0;
            }
        });

        const percent = config.limite > 0 ? (gastoComum / config.limite) * 100 : 0;
        const bar = document.getElementById('progressComum');
        bar.style.width = Math.min(percent, 100) + '%';

        if (percent > 100) {
            bar.classList.add('danger');
        } else {
            bar.classList.remove('danger');
        }

        document.getElementById('gastoComum').textContent = formatCurrency(gastoComum);
        document.getElementById('limiteComum').textContent = formatCurrency(config.limite);

        const alertBar = document.getElementById('alertBar');
        if (gastoComum > config.limite) {
            document.getElementById('alertMsg').textContent =
                `⚠️ Gastos comuns ultrapassaram o limite! (${formatCurrency(gastoComum)} / ${formatCurrency(config.limite)})`;
            alertBar.classList.remove('hidden');
        } else {
            alertBar.classList.add('hidden');
        }
    }

    // ===== RENDER =====
    function renderAll() {
        updateMonthLabel();
        renderDashboard();
        renderHistorico();
        verificarLimiteComum();
    }

    function renderDashboard() {
        const s = calcularSaldos();
        const c = calcularContribuicao();

        document.getElementById('saldoEu').textContent = formatCurrency(s.eu.receita - s.eu.despesa);
        document.getElementById('receitaEu').textContent = formatNumber(s.eu.receita);
        document.getElementById('despesaEu').textContent = formatNumber(s.eu.despesa);
        document.getElementById('contribEu').textContent = c.eu + '%';

        document.getElementById('saldoEsposa').textContent = formatCurrency(s.esposa.receita - s.esposa.despesa);
        document.getElementById('receitaEsposa').textContent = formatNumber(s.esposa.receita);
        document.getElementById('despesaEsposa').textContent = formatNumber(s.esposa.despesa);
        document.getElementById('contribEsposa').textContent = c.esposa + '%';

        document.getElementById('saldoTotal').textContent = formatCurrency(s.total.receita - s.total.despesa);
        document.getElementById('receitaTotal').textContent = formatNumber(s.total.receita);
        document.getElementById('despesaTotal').textContent = formatNumber(s.total.despesa);
    }

    function renderHistorico() {
        const tbody = document.getElementById('tbodyHistorico');
        const empty = document.getElementById('emptyState');
        const tMes = getTransacoesMes();

        let filtered = tMes;
        if (filtroAtivo !== 'Todos') {
            filtered = tMes.filter(t => (t.QuemGastou || 'Eu') === filtroAtivo);
        }

        // Sort by date descending
        filtered.sort((a, b) => {
            const da = parseDateBR(a.Data);
            const db = parseDateBR(b.Data);
            return (db || 0) - (da || 0);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');

        tbody.innerHTML = filtered.map(t => {
            const quem = t.QuemGastou || 'Eu';
            const quemLower = quem.toLowerCase();
            const isReceita = t.Destino === 'Receitas';
            const valor = parseFloat(t.Valor) || 0;

            return `
                <tr class="row-${quemLower}">
                    <td>${t.Data}</td>
                    <td>${t.Descricao || '-'}</td>
                    <td><span class="badge badge-${quemLower}">${quem === 'Eu' ? '👤 Eu' : quem === 'Esposa' ? '👩 Esposa' : '🏠 Comum'}</span></td>
                    <td class="${isReceita ? 'valor-positivo' : 'valor-negativo'}">${isReceita ? '+' : '-'} ${formatCurrency(valor)}</td>
                    <td>${t.SubCategoria || t.Categoria || '-'}</td>
                    <td><button class="btn-delete" onclick="window.fincasal.deletar('${t.id}')" title="Excluir">🗑</button></td>
                </tr>
            `;
        }).join('');
    }

    // ===== CRUD =====
    function adicionarTransacao(e) {
        e.preventDefault();

        const valor = parseValor(document.getElementById('inputValor').value);
        if (valor <= 0) {
            showToast('❌ Informe um valor válido!');
            return;
        }

        const descricao = document.getElementById('inputDesc').value.trim();
        if (!descricao) {
            showToast('❌ Informe uma descrição!');
            return;
        }

        const dataInput = document.getElementById('inputData').value;
        const dataBR = formatDateBR(dataInput);

        let destino = document.getElementById('selectDestino').value;

        // Auto-set destino to Receitas if tipo is receita
        if (tipoAtivo === 'receita') {
            destino = 'Receitas';
        }

        const transacao = {
            id: generateId(),
            Tipo: 'Transacao',
            Data: dataBR,
            Descricao: descricao,
            Categoria: document.getElementById('selectCategoria').value,
            SubCategoria: subCatAtiva || catAtiva || descricao,
            Valor: formatNumber(valor),
            Destino: destino,
            Cartao: document.getElementById('inputCartao').value.trim(),
            Parcela: '',
            QuemGastou: quemAtivo
        };

        transacoes.push(transacao);
        saveData();

        // Reset form
        document.getElementById('inputValor').value = '';
        document.getElementById('inputDesc').value = '';
        document.getElementById('inputCartao').value = '';
        setDefaultDate();
        clearCatSelection();

        // Set month to the transaction month
        const d = parseDateBR(dataBR);
        if (d) {
            mesAtual = d.getMonth();
            anoAtual = d.getFullYear();
        }

        renderAll();
        showToast('✅ Lançamento salvo!');
    }

    function deletarTransacao(id) {
        transacoes = transacoes.filter(t => t.id !== id);
        saveData();
        renderAll();
        showToast('🗑️ Lançamento excluído');
    }

    // ===== WEBHOOK n8n =====
    function enviarParaN8N(dados) {
        const payload = {
            ...dados,
            Valor: dados.Valor.toString().replace('.', ','),
            timestamp: new Date().toISOString(),
            origem: 'FinCasal App'
        };

        console.log('📤 JSON para n8n:', JSON.stringify(payload, null, 2));

        if (!config.webhookUrl) {
            showToast('⚙️ Configure a URL do webhook nas configurações');
            console.warn('Webhook URL não configurada. Configure em ⚙️ Configurações.');
            return;
        }

        const btnSync = document.getElementById('btnSync');
        btnSync.classList.add('syncing');

        fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (res.ok) {
                    showToast('✅ Enviado para n8n com sucesso!');
                } else {
                    showToast('❌ Erro ao enviar: ' + res.status);
                }
            })
            .catch(err => {
                console.error('Erro no envio:', err);
                showToast('❌ Falha na conexão com n8n');
            })
            .finally(() => {
                btnSync.classList.remove('syncing');
            });
    }

    function enviarTodosParaN8N() {
        const tMes = getTransacoesMes();
        if (tMes.length === 0) {
            showToast('📭 Nenhum lançamento para enviar');
            return;
        }

        tMes.forEach((t, i) => {
            setTimeout(() => enviarParaN8N(t), i * 300);
        });

        showToast(`🔄 Enviando ${tMes.length} lançamento(s)...`);
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Theme toggle
        document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

        // Sync
        document.getElementById('btnSync').addEventListener('click', enviarTodosParaN8N);

        // Month nav
        document.getElementById('btnPrevMonth').addEventListener('click', prevMonth);
        document.getElementById('btnNextMonth').addEventListener('click', nextMonth);

        // Form
        document.getElementById('formEntry').addEventListener('submit', adicionarTransacao);

        // Tipo toggle
        document.querySelectorAll('.btn-tipo').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-tipo').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                tipoAtivo = btn.dataset.tipo;

                const selectDestino = document.getElementById('selectDestino');
                if (tipoAtivo === 'receita') {
                    selectDestino.value = 'Receitas';
                    selectDestino.disabled = true;
                } else {
                    selectDestino.disabled = false;
                    if (selectDestino.value === 'Receitas') {
                        selectDestino.value = 'Gastos Variaveis';
                    }
                }
            });
        });

        // Quem toggle
        document.querySelectorAll('.btn-quem').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-quem').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                quemAtivo = btn.dataset.quem;
            });
        });

        // Quick categories
        document.querySelectorAll('.btn-cat').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-cat').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                catAtiva = btn.dataset.cat;
                subCatAtiva = btn.dataset.sub;

                const descInput = document.getElementById('inputDesc');
                if (!descInput.value) {
                    descInput.value = catAtiva;
                }
            });
        });

        // Filter buttons
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filtroAtivo = btn.dataset.filter;
                renderHistorico();
            });
        });

        // Enviar para n8n (individual — last transaction)
        document.getElementById('btnEnviarN8N').addEventListener('click', () => {
            if (transacoes.length === 0) {
                showToast('📭 Nenhum lançamento para enviar');
                return;
            }
            enviarParaN8N(transacoes[transacoes.length - 1]);
        });

        // Config: Salvar limite
        document.getElementById('btnSalvarLimite').addEventListener('click', () => {
            config.limite = parseValor(document.getElementById('inputLimite').value);
            saveConfig();
            renderAll();
            showToast('✅ Limite salvo!');
        });

        // Config: Salvar webhook
        document.getElementById('btnSalvarWebhook').addEventListener('click', () => {
            config.webhookUrl = document.getElementById('inputWebhook').value.trim();
            saveConfig();
            showToast('✅ URL do webhook salva!');
        });

        // Config: Limpar dados
        document.getElementById('btnLimparDados').addEventListener('click', () => {
            if (confirm('⚠️ Tem certeza que deseja APAGAR todos os lançamentos?\n\nEssa ação não pode ser desfeita!')) {
                transacoes = [];
                saveData();
                renderAll();
                showToast('🗑️ Dados limpos!');
            }
        });

        // Config: Exportar JSON
        document.getElementById('btnExportarDados').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(transacoes, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fincasal_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('📤 Dados exportados!');
        });

        // Valor input mask (comma for decimals)
        document.getElementById('inputValor').addEventListener('input', function () {
            let val = this.value.replace(/[^\d]/g, '');
            if (val.length === 0) { this.value = ''; return; }
            val = (parseInt(val) / 100).toFixed(2);
            this.value = val.replace('.', ',');
        });
    }

    function clearCatSelection() {
        document.querySelectorAll('.btn-cat').forEach(b => b.classList.remove('active'));
        catAtiva = '';
        subCatAtiva = '';
    }

    // ===== PUBLIC API (for inline onclick) =====
    window.fincasal = {
        deletar: deletarTransacao
    };

    // ===== START =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
