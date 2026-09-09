'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useMemo, useState, useEffect } from 'react';
import { 
    Home,
    CalendarClock, 
    AlertCircle, 
    CalendarDays, 
    CheckSquare, 
    ShoppingBag, 
    ArrowRight, 
    CreditCard, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Sparkles, 
    Layers,
    Clock
} from 'lucide-react';
import Balances from '@/components/Balances';
import { formatCurrency, formatDate, parseLocalDate } from '@/lib/format';

export default function Dashboard({ 
    transactions = [], 
    allTransactions = [], 
    cardsSummary = [],
    cartoes = [],
    partner1 = 'Alle', 
    partner2 = 'Kelly', 
    onAddMany, 
    onDeleteByIds, 
    viewDate,
    tasks = [],
    wishlist = [],
    onNavigateTab,
    onOpenAddTransaction,
    isPrivate = false,
    onSettleDebt
}) {
    const txs = useMemo(() => (Array.isArray(transactions) ? transactions : []), [transactions]);
    const allTxs = useMemo(() => (Array.isArray(allTransactions) ? allTransactions : []), [allTransactions]);

    const [financiamentos, setFinanciamentos] = useState(() => {
        if (typeof window === 'undefined') return [];
        try {
            return JSON.parse(localStorage.getItem('fincasal_financiamentos')) || [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        const updateFin = () => {
            try {
                setFinanciamentos(JSON.parse(localStorage.getItem('fincasal_financiamentos')) || []);
            } catch {}
        };
        window.addEventListener('fincasal:financiamentos-changed', updateFin);
        return () => window.removeEventListener('fincasal:financiamentos-changed', updateFin);
    }, []);

    const primaryFinanciamento = useMemo(() => {
        if (!financiamentos || financiamentos.length === 0) return null;
        const f = financiamentos[0];
        const rows = allTxs.filter(
            (t) => t && t.description && (t.description === f.nome || t.description.startsWith(f.nome + ' ('))
        );
        const paid = rows.filter((t) => t.pago).length;
        const lastPaid = paid > 0 ? f.parcelaAtual + paid - 1 : f.parcelaAtual - 1;
        const next = Math.min(lastPaid + 1, f.total);
        const nextValor = Math.max(0, f.valorAtual - (next - f.parcelaAtual) * f.desconto);
        const progress = f.total > 0 ? Math.min(100, (Math.max(0, lastPaid) / f.total) * 100) : 0;
        return {
            ...f,
            paid,
            lastPaid,
            next,
            nextValor,
            progress: Math.round(progress),
        };
    }, [financiamentos, allTxs]);

    const [manualSaldo, setManualSaldo] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const a = parseFloat(localStorage.getItem('fincasal_saldo_alle')) || 0;
        const k = parseFloat(localStorage.getItem('fincasal_saldo_kelly')) || 0;
        return a + k;
    });

    const summary = useMemo(() => {
        const incomeTxs = txs.filter((t) => t && t.type === 'income');
        const income = incomeTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const incomePaid = incomeTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const incomePending = incomeTxs.filter((t) => !t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const registeredCardNames = new Set((cartoes || []).map((c) => c && c.nome).filter(Boolean));
        const isCreditTx = (t) => t && (t.type === 'credit' || t.payment_method === 'credit' || (t.card_name && registeredCardNames.has(t.card_name)));

        const checkingExpensesTxs = txs.filter((t) => t && t.type === 'expense' && !isCreditTx(t));
        const checkingTotal = checkingExpensesTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const checkingPaid = checkingExpensesTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const checkingPending = checkingExpensesTxs.filter((t) => !t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const cardsList = Array.isArray(cardsSummary) ? cardsSummary : [];
        const creditExpenses = cardsList.reduce((acc, c) => acc + Number(c.faturaAtual || 0), 0);
        const creditPaid = cardsList.filter((c) => c.isPaga).reduce((acc, c) => acc + Number(c.faturaAtual || 0), 0);
        const creditPending = cardsList.filter((c) => !c.isPaga).reduce((acc, c) => acc + Number(c.faturaAtual || 0), 0);

        const orphanCreditTxs = txs.filter((t) => isCreditTx(t) && !cardsList.some((c) => c.nome === t.card_name));
        const orphanCreditTotal = orphanCreditTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const orphanCreditPaid = orphanCreditTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const orphanCreditPending = orphanCreditTxs.filter((t) => !t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const totalCreditInvoices = creditExpenses + orphanCreditTotal;
        const totalCreditPaid = creditPaid + orphanCreditPaid;
        const totalCreditPending = creditPending + orphanCreditPending;

        const totalExpenses = checkingTotal + totalCreditInvoices;
        const totalPaidExpenses = checkingPaid + totalCreditPaid;
        const totalPendingExpenses = checkingPending + totalCreditPending;

        const fixedTxs = txs.filter((t) => t && t.fixa && t.type !== 'income');
        const fixedTotal = fixedTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const fixedPaid = fixedTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        return {
            income,
            incomePaid,
            incomePending,
            checkingTotal,
            checkingPaid,
            checkingPending,
            creditExpenses: totalCreditInvoices,
            creditPaid: totalCreditPaid,
            creditPending: totalCreditPending,
            totalExpenses,
            totalPaidExpenses,
            totalPendingExpenses,
            fixedTotal,
            fixedPaid,
        };
    }, [txs, cardsSummary, cartoes]);

    const financeSummary = useMemo(() => {
        const monthBalance = summary.income - summary.totalExpenses;

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        const targetDate = viewDate ? (viewDate instanceof Date ? viewDate : new Date(viewDate)) : today;
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();

        const isCurrent = targetYear === currentYear && targetMonth === currentMonth;
        const isPast = targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth);
        const isFuture = targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth);

        const registeredCardNames = new Set((cartoes || []).map((c) => c && c.nome).filter(Boolean));
        const isCreditTx = (t) => t && (t.type === 'credit' || t.payment_method === 'credit' || (t.card_name && registeredCardNames.has(t.card_name)));

        let ajustes = {};
        let faturasPagas = {};
        try {
            if (typeof window !== 'undefined') {
                ajustes = JSON.parse(localStorage.getItem('fincasal_ajustes_faturas')) || {};
                faturasPagas = JSON.parse(localStorage.getItem('fincasal_faturas_pagas')) || {};
            }
        } catch {}

        const getMonthNetPendingFlow = (y, m) => {
            const mMatches = allTxs.filter((t) => {
                if (!t || !t.date) return false;
                const d = parseLocalDate(t.date);
                if (!d) return false;
                return d.getMonth() === m && d.getFullYear() === y;
            });

            const incomePending = mMatches
                .filter((t) => t.type === 'income' && !t.pago)
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);

            const checkingPending = mMatches
                .filter((t) => t.type === 'expense' && !isCreditTx(t) && !t.pago)
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);

            const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
            let creditPending = 0;

            (cartoes || []).forEach((card) => {
                if (!card || !card.nome) return;
                const cardMatches = mMatches.filter((t) => t.card_name === card.nome && t.type === 'credit');
                const soma = cardMatches.reduce((acc, t) => acc + Number(t.amount || 0), 0);
                const key = `${card.nome}|${monthKey}`;
                const ajustado = ajustes[key];
                const faturaAtual = ajustado != null ? Number(ajustado) : soma;
                const manualPaidStatus = faturasPagas[key];
                const isPaga = typeof manualPaidStatus === 'boolean'
                    ? manualPaidStatus
                    : (cardMatches.length > 0 && cardMatches.every((t) => t.pago));

                if (!isPaga) {
                    creditPending += faturaAtual;
                }
            });

            const orphanCreditPending = mMatches
                .filter((t) => isCreditTx(t) && !(cartoes || []).some((c) => c && c.nome === t.card_name) && !t.pago)
                .reduce((acc, t) => acc + Number(t.amount || 0), 0);

            const totalPendingExpenses = checkingPending + creditPending + orphanCreditPending;

            return {
                incomePending,
                totalPendingExpenses,
                netPending: incomePending - totalPendingExpenses,
            };
        };

        let cumulativePrevisto = manualSaldo;

        if (isCurrent) {
            cumulativePrevisto = manualSaldo + summary.incomePending - summary.totalPendingExpenses;
        } else if (isFuture) {
            let iterY = currentYear;
            let iterM = currentMonth;
            while (iterY < targetYear || (iterY === targetYear && iterM <= targetMonth)) {
                const flow = getMonthNetPendingFlow(iterY, iterM);
                cumulativePrevisto += flow.netPending;
                iterM++;
                if (iterM > 11) {
                    iterM = 0;
                    iterY++;
                }
            }
        } else {
            cumulativePrevisto = monthBalance;
        }

        return {
            saldoAtual: manualSaldo,
            monthBalance,
            cumulativePrevisto,
            pendingIncome: summary.incomePending,
            pendingExpense: summary.totalPendingExpenses,
            isCurrent,
            isFuture,
            isPast,
        };
    }, [allTxs, summary, manualSaldo, viewDate, cartoes]);

    const dueExpenses = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 7);

        const vencidas = [];
        const proximas = [];

        allTxs.forEach((t) => {
            if (!t || t.pago || (t.type !== 'expense' && t.type !== 'credit') || !t.date) return;
            const d = new Date(t.date.slice(0, 10) + 'T00:00:00');
            if (isNaN(d.getTime())) return;
            const diff = Math.floor((d - today) / 86400000);
            if (diff < 0) vencidas.push({ ...t, _days: Math.abs(diff) });
            else if (diff <= 7) proximas.push({ ...t, _days: diff });
        });

        vencidas.sort((a, b) => b._days - a._days);
        proximas.sort((a, b) => a._days - b._days);

        const totalVencidas = vencidas.reduce((a, t) => a + Number(t.amount || 0), 0);
        const totalProximas = proximas.reduce((a, t) => a + Number(t.amount || 0), 0);

        return {
            vencidas,
            proximas,
            totalVencidas,
            totalProximas,
            totalGeral: totalVencidas + totalProximas,
        };
    }, [allTxs]);

    const coupleSummary = useMemo(() => {
        const isExpense = (t) => t && (t.type === 'expense' || t.type === 'credit');

        const p1Personal = txs
            .filter((t) => isExpense(t) && t.quem === 'Eu')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p2Personal = txs
            .filter((t) => isExpense(t) && t.quem === 'Outro')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const commonTotal = txs
            .filter((t) => isExpense(t) && t.quem && t.quem.startsWith('Comum'))
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        let p1CommonPaid = 0;
        let p2CommonPaid = 0;
        let p1PaidForP2 = 0;
        let p2PaidForP1 = 0;
        let p1TotalDisbursed = 0;
        let p2TotalDisbursed = 0;

        txs.forEach((t) => {
            if (!isExpense(t) || !t.pago) return;
            const amount = Number(t.amount || 0);
            const isCommon = t.quem && t.quem.startsWith('Comum');
            const isP1 = t.quem === 'Eu';
            const isP2 = t.quem === 'Outro';

            let allePaid = 0;
            let kellyPaid = 0;

            if (t.pago_alle !== undefined && t.pago_alle !== null && Number(t.pago_alle) > 0) {
                allePaid = Number(t.pago_alle);
            } else if (t.pago_por === 'alle' || t.quem === 'Comum - Eu') {
                allePaid = amount;
            } else if (t.pago_por === '50_50') {
                allePaid = Math.round((amount / 2) * 100) / 100;
            } else if (t.pago_por === null && isP1) {
                allePaid = amount;
            }

            if (t.pago_kelly !== undefined && t.pago_kelly !== null && Number(t.pago_kelly) > 0) {
                kellyPaid = Number(t.pago_kelly);
            } else if (t.pago_por === 'kelly' || t.quem === 'Comum - Outro') {
                kellyPaid = amount;
            } else if (t.pago_por === '50_50') {
                kellyPaid = Math.round((amount - (Math.round((amount / 2) * 100) / 100)) * 100) / 100;
            } else if (t.pago_por === null && isP2) {
                kellyPaid = amount;
            }

            p1TotalDisbursed += allePaid;
            p2TotalDisbursed += kellyPaid;

            if (isCommon) {
                p1CommonPaid += allePaid;
                p2CommonPaid += kellyPaid;
            } else if (isP1) {
                if (kellyPaid > 0) p2PaidForP1 += kellyPaid;
            } else if (isP2) {
                if (allePaid > 0) p1PaidForP2 += allePaid;
            }
        });

        const netAlleCredit = ((p1CommonPaid - p2CommonPaid) / 2) + p1PaidForP2 - p2PaidForP1;
        const debtAmount = Math.abs(netAlleCredit);

        let debtMessage = '';
        let debtor = '';
        let creditor = '';

        if (netAlleCredit > 0.05) {
            debtor = partner2;
            creditor = partner1;
            debtMessage = `${partner2} deve transferir ${formatCurrency(debtAmount)} para ${partner1}`;
        } else if (netAlleCredit < -0.05) {
            debtor = partner1;
            creditor = partner2;
            debtMessage = `${partner1} deve transferir ${formatCurrency(debtAmount)} para ${partner2}`;
        } else {
            debtMessage = 'Contas compartilhadas equilibradas!';
        }

        const totalPersonal = p1Personal + p2Personal;
        const p1Percent = totalPersonal > 0 ? (p1Personal / totalPersonal) * 100 : 50;
        const p2Percent = totalPersonal > 0 ? (p2Personal / totalPersonal) * 100 : 50;

        return {
            p1Personal,
            p2Personal,
            commonTotal,
            p1CommonPaid,
            p2CommonPaid,
            p1TotalDisbursed,
            p2TotalDisbursed,
            debtMessage,
            debtAmount,
            debtor,
            creditor,
            p1Percent,
            p2Percent
        };
    }, [txs, partner1, partner2]);

    const displayAmount = (val) => {
        if (isPrivate) return '••••••';
        return formatCurrency(val);
    };

    const currentMonthLabel = (viewDate ? new Date(viewDate) : new Date()).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* HERO CARD COMPACTO */}
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-[#131b2e] via-[#0f172a] to-[#0a0e1a] p-3.5 sm:p-5 shadow-xl">
                <div className="relative space-y-3.5 sm:space-y-4">
                    {/* Partner Balances Row */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                                Saldos em Conta
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-500">Nuvem ativa</span>
                        </div>
                        <Balances
                            partner1={partner1}
                            partner2={partner2}
                            onChange={setManualSaldo}
                            isPrivate={isPrivate}
                        />
                    </div>

                    {/* Main Totals: Saldo Atual vs Previsto */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-2 border-t border-white/10">
                        {/* Saldo Total Consolidado */}
                        <div className="space-y-0.5">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Saldo Atual
                            </p>
                            <p className={`text-lg sm:text-2xl font-black tracking-tight truncate ${financeSummary.saldoAtual >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {displayAmount(financeSummary.saldoAtual)}
                            </p>
                        </div>

                        {/* Previsto Fim do Mês */}
                        <div className="space-y-0.5 border-l border-white/10 pl-2.5 sm:pl-4">
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                                    <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-indigo-400" />
                                    Previsto ({currentMonthLabel.slice(0, 3)})
                                </p>
                                <span
                                    className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded-md leading-none truncate ${
                                        financeSummary.monthBalance >= 0
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    }`}
                                >
                                    {financeSummary.monthBalance >= 0 ? `+${displayAmount(financeSummary.monthBalance)}` : displayAmount(financeSummary.monthBalance)} no mês
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <p className={`text-lg sm:text-2xl font-black tracking-tight truncate ${financeSummary.cumulativePrevisto >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                                    {displayAmount(financeSummary.cumulativePrevisto)}
                                </p>
                                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold hidden xs:inline">
                                    acumulado
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary Badges (Compact 4-Pill Grid) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-white/10">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">
                            <span className="text-[9px] text-emerald-400 uppercase font-black block truncate">Receitas</span>
                            <span className="text-xs sm:text-sm font-bold text-white block truncate">+{displayAmount(summary.income)}</span>
                        </div>
                        <div className="bg-slate-800/60 border border-white/10 rounded-xl p-2">
                            <span className="text-[9px] text-slate-400 uppercase font-black block truncate">Débito/PIX</span>
                            <span className="text-xs sm:text-sm font-bold text-slate-200 block truncate">{displayAmount(summary.checkingTotal)}</span>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2">
                            <span className="text-[9px] text-purple-400 uppercase font-black block truncate">Faturas Cartão</span>
                            <span className="text-xs sm:text-sm font-bold text-purple-300 block truncate">{displayAmount(summary.creditExpenses)}</span>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2">
                            <span className="text-[9px] text-rose-400 uppercase font-black block truncate">Total Despesas</span>
                            <span className="text-xs sm:text-sm font-bold text-rose-300 block truncate">-{displayAmount(summary.totalExpenses)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* QUICK ACTIONS ROW (Navegação Rápida) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {onNavigateTab && (
                    <>
                        <button
                            onClick={() => onNavigateTab('financas', 'transacoes')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <Layers className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Extrato Completo</span>
                        </button>
                        <button
                            onClick={() => onNavigateTab('financas', 'cartoes')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                            <span>Cartões ({cartoes.length})</span>
                        </button>
                        <button
                            onClick={() => onNavigateTab('tarefas')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
                            <span>Tarefas ({tasks.filter(t => !t.completed).length})</span>
                        </button>
                        <button
                            onClick={() => onNavigateTab('desejos')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Desejos ({wishlist.filter(w => (w.status || 'planned') === 'planned').length})</span>
                        </button>
                    </>
                )}
            </div>

            {/* DESPESAS COM VENCIMENTO */}
            {(dueExpenses.totalVencidas > 0 || dueExpenses.totalProximas > 0) && (
                <Card className="border-amber-500/25 bg-amber-950/10 backdrop-blur-md overflow-hidden rounded-2xl">
                    <CardContent className="p-3.5 sm:p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                            <h3 className="text-xs sm:text-sm font-bold text-amber-400 flex items-center gap-1.5">
                                <CalendarClock className="h-4 w-4" /> Alertas de Vencimento
                            </h3>
                            <span className="text-[10px] font-black uppercase text-slate-400">
                                Total: {displayAmount(dueExpenses.totalGeral)}
                            </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                            {/* Vencidas */}
                            {dueExpenses.vencidas.length > 0 && (
                                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 space-y-1.5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" /> Vencidas ({dueExpenses.vencidas.length})
                                    </p>
                                    <div className="space-y-1">
                                        {dueExpenses.vencidas.slice(0, 3).map((t) => (
                                             <div key={t.id} className="flex items-center justify-between gap-2 bg-[#0a0e1a]/80 rounded-lg px-2.5 py-1.5 border border-white/5 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-200 truncate text-[11px]">{t.description}</p>
                                                    <p className="text-[9px] text-rose-400/80">{formatDate(t.date)} • {t._days}d atrás</p>
                                                </div>
                                                <span className="font-black text-rose-400 shrink-0 text-xs">{displayAmount(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Próximos 7 Dias */}
                            {dueExpenses.proximas.length > 0 && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1.5">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3" /> Vencendo ({dueExpenses.proximas.length})
                                    </p>
                                    <div className="space-y-1">
                                        {dueExpenses.proximas.slice(0, 3).map((t) => (
                                            <div key={t.id} className="flex items-center justify-between gap-2 bg-[#0a0e1a]/80 rounded-lg px-2.5 py-1.5 border border-white/5 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-200 truncate text-[11px]">{t.description}</p>
                                                    <p className="text-[9px] text-amber-400/80">{formatDate(t.date)} • {t._days === 0 ? 'Hoje' : `em ${t._days}d`}</p>
                                                </div>
                                                <span className="font-black text-amber-400 shrink-0 text-xs">{displayAmount(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* FINANCIAMENTOS (CARD COMPACTO E ELEGANTE) */}
            {primaryFinanciamento && (
                <Card className="border-indigo-500/25 bg-gradient-to-r from-indigo-950/20 via-[#121827] to-[#0a0e1a] backdrop-blur-md rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all shadow-lg">
                    <CardContent className="p-3.5 sm:p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                                    <Home className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">{primaryFinanciamento.nome}</h4>
                                    <p className="text-[10px] text-slate-400">
                                        Parcela <strong className="text-slate-200">{primaryFinanciamento.next}</strong> de {primaryFinanciamento.total} • Vence dia {primaryFinanciamento.dia}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-xs sm:text-sm font-black text-indigo-300 block">
                                    {displayAmount(primaryFinanciamento.nextValor || primaryFinanciamento.valorAtual)}
                                </span>
                                <span className="text-[9px] text-emerald-400 font-black block">{primaryFinanciamento.progress}% pago</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-700"
                                    style={{ width: `${primaryFinanciamento.progress}%` }}
                                />
                            </div>
                        </div>
                        {onNavigateTab && (
                            <button
                                type="button"
                                onClick={() => onNavigateTab('financas', 'financiamentos')}
                                className="w-full py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white text-[11px] font-bold border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                            >
                                <span>Ver Amortizações, Parcelas & Simulações</span>
                                <ArrowRight className="h-3 w-3" />
                            </button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* COMPROMISSOS FIXOS DO MÊS */}
            {summary.fixedTotal > 0 && (
                <Card className="border-blue-500/20 bg-blue-950/10 backdrop-blur-md rounded-2xl">
                    <CardContent className="p-3.5 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                                <h3 className="text-xs sm:text-sm font-bold text-blue-400 flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" /> Contas Fixas do Mês
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Pago <span className="text-emerald-400 font-bold">{displayAmount(summary.fixedPaid)}</span> de <span className="text-slate-200 font-bold">{displayAmount(summary.fixedTotal)}</span> ({Math.round((summary.fixedPaid / summary.fixedTotal) * 100)}%)
                                </p>
                            </div>

                            <div className="w-full sm:w-1/3">
                                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-700"
                                        style={{ width: `${Math.min((summary.fixedPaid / summary.fixedTotal) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* PAINEL DO CASAL (Compact 3-Col Layout) */}
            <Card className="border-indigo-500/20 bg-indigo-950/10 backdrop-blur-md rounded-2xl">
                <CardContent className="p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-2">
                        <h3 className="text-xs sm:text-sm font-bold text-indigo-300">
                            Divisão do Casal ({partner1} & {partner2})
                        </h3>
                        <p className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-lg self-start sm:self-auto">
                            {coupleSummary.debtMessage}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                        <div className="bg-[#0a0e1a]/80 p-2 sm:p-3 rounded-xl border border-white/5 space-y-0.5">
                            <p className="text-[8px] sm:text-[9px] text-purple-400 uppercase font-black truncate">Só {partner1}</p>
                            <p className="text-xs sm:text-base font-black text-white truncate">{displayAmount(coupleSummary.p1Personal)}</p>
                        </div>
                        <div className="bg-[#0a0e1a]/80 p-2 sm:p-3 rounded-xl border border-white/5 space-y-0.5">
                            <p className="text-[8px] sm:text-[9px] text-rose-400 uppercase font-black truncate">Só {partner2}</p>
                            <p className="text-xs sm:text-base font-black text-white truncate">{displayAmount(coupleSummary.p2Personal)}</p>
                        </div>
                        <div className="bg-[#0a0e1a]/80 p-2 sm:p-3 rounded-xl border border-white/5 space-y-0.5">
                            <p className="text-[8px] sm:text-[9px] text-teal-400 uppercase font-black truncate">Comum</p>
                            <p className="text-xs sm:text-base font-black text-white truncate">{displayAmount(coupleSummary.commonTotal)}</p>
                        </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-white/5">
                        <span className="font-medium">Desembolso real pago:</span>
                        <span className="font-bold text-slate-300">
                            {partner1}: <span className="text-purple-300">{displayAmount(coupleSummary.p1TotalDisbursed)}</span> • {partner2}: <span className="text-rose-300">{displayAmount(coupleSummary.p2TotalDisbursed)}</span>
                        </span>
                    </div>

                    {/* Botão de 1 clique para liquidar o acerto */}
                    {coupleSummary.debtAmount > 0.05 && onSettleDebt && (
                        <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400">
                                Pix de acerto de contas pendente:
                            </span>
                            <button
                                type="button"
                                onClick={() => onSettleDebt({
                                    debtor: coupleSummary.debtor,
                                    creditor: coupleSummary.creditor,
                                    amount: coupleSummary.debtAmount
                                })}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 self-stretch sm:self-auto"
                            >
                                <span>💸</span>
                                <span>Liquidar Acerto (Pix)</span>
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MINI WIDGETS: TAREFAS & DESEJOS */}
            <div className="grid gap-2.5 sm:grid-cols-2">
                {/* Mini-Widget: Tarefas */}
                <Card className="bg-[#121827]/70 border-white/10 rounded-2xl">
                    <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-cyan-400" />
                                <h4 className="text-xs sm:text-sm font-bold text-white">Tarefas da Casa</h4>
                                <span className="text-[10px] text-slate-400">({tasks.filter(t => !t.completed).length})</span>
                            </div>
                            {onNavigateTab && (
                                <button
                                    onClick={() => onNavigateTab('tarefas')}
                                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                                >
                                    Ver <ArrowRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-1">
                            {tasks.filter(t => !t.completed).slice(0, 2).map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0a0e1a]/80 border border-white/5 text-xs">
                                    <span className="font-medium text-slate-200 truncate text-[11px] mr-1">{task.title}</span>
                                    <span className="text-[8px] font-black uppercase text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded shrink-0">
                                        {task.assigned_to || 'Casa'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Mini-Widget: Desejos */}
                <Card className="bg-[#121827]/70 border-white/10 rounded-2xl">
                    <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-emerald-400" />
                                <h4 className="text-xs sm:text-sm font-bold text-white">Desejos & Compras</h4>
                                <span className="text-[10px] text-slate-400">({wishlist.filter(w => (w.status || 'planned') === 'planned').length})</span>
                            </div>
                            {onNavigateTab && (
                                <button
                                    onClick={() => onNavigateTab('desejos')}
                                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                                >
                                    Ver <ArrowRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-1">
                            {wishlist.filter(w => (w.status || 'planned') === 'planned').slice(0, 2).map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0a0e1a]/80 border border-white/5 text-xs">
                                    <p className="font-medium text-slate-200 truncate text-[11px] mr-1">{item.title}</p>
                                    <span className="font-bold text-emerald-400 shrink-0 text-[11px]">
                                        {item.price > 0 ? displayAmount(item.price) : 'R$ --'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}