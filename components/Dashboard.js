'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { 
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
import Financiamentos from '@/components/Financiamentos';
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
    isPrivate = false
}) {
    const txs = useMemo(() => (Array.isArray(transactions) ? transactions : []), [transactions]);
    const allTxs = useMemo(() => (Array.isArray(allTransactions) ? allTransactions : []), [allTransactions]);

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

        return {
            saldoAtual: manualSaldo,
            previsto: monthBalance,
            pendingIncome: summary.incomePending,
            pendingExpense: summary.totalPendingExpenses,
        };
    }, [summary, manualSaldo]);

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

        const p1CommonPaid = txs
            .filter((t) => isExpense(t) && t.quem === 'Comum - Eu')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p2CommonPaid = txs
            .filter((t) => isExpense(t) && t.quem === 'Comum - Outro')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        let debtMessage = '';
        let debtor = '';
        let creditor = '';
        let debtAmount = 0;

        if (p1CommonPaid > p2CommonPaid) {
            debtAmount = (p1CommonPaid - p2CommonPaid) / 2;
            debtor = partner2;
            creditor = partner1;
            debtMessage = `${partner2} deve pagar ${formatCurrency(debtAmount)} a ${partner1}`;
        } else if (p2CommonPaid > p1CommonPaid) {
            debtAmount = (p2CommonPaid - p1CommonPaid) / 2;
            debtor = partner1;
            creditor = partner2;
            debtMessage = `${partner1} deve pagar ${formatCurrency(debtAmount)} a ${partner2}`;
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
            debtMessage,
            debtAmount,
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
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-indigo-400" />
                                Previsto ({currentMonthLabel.slice(0, 3)})
                            </p>
                            <p className={`text-lg sm:text-2xl font-black tracking-tight truncate ${financeSummary.previsto > 0 ? 'text-indigo-300' : financeSummary.previsto < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                {financeSummary.previsto > 0 ? `+${displayAmount(financeSummary.previsto)}` : displayAmount(financeSummary.previsto)}
                            </p>
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

            {/* QUICK ACTIONS ROW (Scrollable Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {onOpenAddTransaction && (
                    <>
                        <button
                            onClick={() => onOpenAddTransaction('expense')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <ArrowDownLeft className="h-3.5 w-3.5 text-rose-400" />
                            <span>+ Despesa</span>
                        </button>
                        <button
                            onClick={() => onOpenAddTransaction('income')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                            <span>+ Receita</span>
                        </button>
                        <button
                            onClick={() => onOpenAddTransaction('credit')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                            <span>+ Cartão</span>
                        </button>
                    </>
                )}
                {onNavigateTab && (
                    <>
                        <button
                            onClick={() => onNavigateTab('financas')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <Layers className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Extrato</span>
                        </button>
                        <button
                            onClick={() => onNavigateTab('tarefas')}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
                            <span>Tarefas ({tasks.filter(t => !t.completed).length})</span>
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

            {/* FINANCIAMENTOS (CASA / VEÍCULOS) */}
            <Financiamentos
                transactions={allTxs}
                onAddMany={onAddMany}
                onDeleteByIds={onDeleteByIds}
            />

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