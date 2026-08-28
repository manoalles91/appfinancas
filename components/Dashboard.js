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
    PlusCircle, 
    CreditCard, 
    TrendingUp, 
    TrendingDown, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Sparkles, 
    Layers,
    Clock
} from 'lucide-react';
import Balances from '@/components/Balances';
import Financiamentos from '@/components/Financiamentos';
import { formatCurrency, formatDate } from '@/lib/format';

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
        // 1. Receitas do mês
        const incomeTxs = txs.filter((t) => t && t.type === 'income');
        const income = incomeTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const incomePaid = incomeTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const incomePending = incomeTxs.filter((t) => !t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        // 2. Identificação de compras de cartão de crédito
        const registeredCardNames = new Set((cartoes || []).map((c) => c && c.nome).filter(Boolean));
        const isCreditTx = (t) => t && (t.type === 'credit' || t.payment_method === 'credit' || (t.card_name && registeredCardNames.has(t.card_name)));

        // 3. Despesas de Conta / Dinheiro / Débito / PIX (exclui compras de cartão registradas)
        const checkingExpensesTxs = txs.filter((t) => t && t.type === 'expense' && !isCreditTx(t));
        const checkingTotal = checkingExpensesTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const checkingPaid = checkingExpensesTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const checkingPending = checkingExpensesTxs.filter((t) => !t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        // 4. Faturas de Cartões de Crédito
        const cardsList = Array.isArray(cardsSummary) ? cardsSummary : [];
        const creditExpenses = cardsList.reduce((acc, c) => acc + Number(c.faturaAtual || 0), 0);
        const creditPaid = cardsList.filter((c) => c.isPaga).reduce((acc, c) => acc + Number(c.faturaAtual || 0), 0);
        const creditPending = cardsList.filter((c) => !c.isPaga).reduce((acc, c) => acc + Number(c.faturaAtual || 0), 0);

        // Se houver transações de cartão não cadastradas:
        const orphanCreditTxs = txs.filter((t) => isCreditTx(t) && !cardsList.some((c) => c.nome === t.card_name));
        const orphanCreditTotal = orphanCreditTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const orphanCreditPaid = orphanCreditTxs.filter((t) => t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const orphanCreditPending = orphanCreditTxs.filter((t) => !t.pago).reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const totalCreditInvoices = creditExpenses + orphanCreditTotal;
        const totalCreditPaid = creditPaid + orphanCreditPaid;
        const totalCreditPending = creditPending + orphanCreditPending;

        // 5. Totais consolidados de despesas
        const totalExpenses = checkingTotal + totalCreditInvoices;
        const totalPaidExpenses = checkingPaid + totalCreditPaid;
        const totalPendingExpenses = checkingPending + totalCreditPending;

        // 6. Contas fixas do mês
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
        const pendingIncome = summary.incomePending;
        const pendingExpense = summary.totalPendingExpenses;
        const previsto = manualSaldo + pendingIncome - pendingExpense;

        return {
            saldoAtual: manualSaldo,
            previsto,
            pendingIncome,
            pendingExpense,
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

        const sum = (list) => list.reduce((acc, t) => acc + Number(t.amount || 0), 0);

        return {
            vencidas,
            proximas,
            totalVencidas: sum(vencidas),
            totalProximas: sum(proximas),
            totalGeral: sum(vencidas) + sum(proximas),
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
            debtMessage = `${partner2} deve transferir ${formatCurrency(debtAmount)} para ${partner1}`;
        } else if (p2CommonPaid > p1CommonPaid) {
            debtAmount = (p2CommonPaid - p1CommonPaid) / 2;
            debtor = partner1;
            creditor = partner2;
            debtMessage = `${partner1} deve transferir ${formatCurrency(debtAmount)} para ${partner2}`;
        } else {
            debtMessage = 'Despesas comuns equilibradas!';
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
        <div className="space-y-6 animate-fade-in">
            {/* HERO CARD FINTECH */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#131b2e] via-[#0f172a] to-[#0a0e1a] p-5 sm:p-7 shadow-2xl">
                {/* Background Glow Orbs */}
                <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                <div className="relative space-y-6">
                    {/* Partner Balances Row */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                Contas da Família
                            </span>
                            <span className="text-[11px] text-slate-500">Sincronizado na nuvem</span>
                        </div>
                        <Balances
                            partner1={partner1}
                            partner2={partner2}
                            onChange={setManualSaldo}
                            isPrivate={isPrivate}
                        />
                    </div>

                    {/* Main Totals: Saldo Atual vs Previsto */}
                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-white/10">
                        {/* Saldo Total Consolidado */}
                        <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                Saldo Total Atual ({partner1} + {partner2})
                            </p>
                            <p className={`text-3xl sm:text-4xl font-black tracking-tight ${financeSummary.saldoAtual >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {displayAmount(financeSummary.saldoAtual)}
                            </p>
                            <p className="text-xs text-slate-400">Disponível em contas hoje</p>
                        </div>

                        {/* Previsto Fim do Mês */}
                        <div className="space-y-1 sm:border-l sm:border-white/10 sm:pl-6">
                            <p className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                                Projeção Fim de {currentMonthLabel}
                            </p>
                            <p className={`text-3xl sm:text-4xl font-black tracking-tight ${financeSummary.previsto >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                                {displayAmount(financeSummary.previsto)}
                            </p>
                            <p className="text-xs text-slate-400">
                                +<span className="text-emerald-400 font-bold">{displayAmount(financeSummary.pendingIncome)}</span> a receber &nbsp;•&nbsp; 
                                -<span className="text-rose-400 font-bold">{displayAmount(financeSummary.pendingExpense)}</span> a pagar
                            </p>
                        </div>
                    </div>

                    {/* Financial Summary Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/10 text-xs">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                            <span className="text-[10px] text-emerald-400 uppercase font-black block">Receitas do Mês</span>
                            <span className="text-sm font-bold text-white">+{displayAmount(summary.income)}</span>
                        </div>
                        <div className="bg-slate-800/60 border border-white/10 rounded-xl p-2.5">
                            <span className="text-[10px] text-slate-400 uppercase font-black block">Contas em Débito/PIX</span>
                            <span className="text-sm font-bold text-slate-200">{displayAmount(summary.checkingTotal)}</span>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5">
                            <span className="text-[10px] text-purple-400 uppercase font-black block">Faturas de Cartão</span>
                            <span className="text-sm font-bold text-purple-300">{displayAmount(summary.creditExpenses)}</span>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                            <span className="text-[10px] text-rose-400 uppercase font-black block">Total Despesas</span>
                            <span className="text-sm font-bold text-rose-300">-{displayAmount(summary.totalExpenses)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* QUICK ACTIONS ROW */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {onOpenAddTransaction && (
                    <>
                        <button
                            onClick={() => onOpenAddTransaction('expense')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                        >
                            <ArrowDownLeft className="h-4 w-4 text-rose-400" />
                            + Nova Despesa
                        </button>
                        <button
                            onClick={() => onOpenAddTransaction('income')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                        >
                            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                            + Nova Receita
                        </button>
                        <button
                            onClick={() => onOpenAddTransaction('credit')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                        >
                            <CreditCard className="h-4 w-4 text-purple-400" />
                            + Compra no Cartão
                        </button>
                    </>
                )}
                {onNavigateTab && (
                    <>
                        <button
                            onClick={() => onNavigateTab('financas')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <Layers className="h-4 w-4 text-indigo-400" />
                            Ver Extrato
                        </button>
                        <button
                            onClick={() => onNavigateTab('tarefas')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <CheckSquare className="h-4 w-4 text-cyan-400" />
                            Tarefas ({tasks.filter(t => !t.completed).length})
                        </button>
                    </>
                )}
            </div>

            {/* DESPESAS COM VENCIMENTO (VENCIDAS & PRÓXIMOS 7 DIAS) */}
            {(dueExpenses.totalVencidas > 0 || dueExpenses.totalProximas > 0) && (
                <Card className="border-amber-500/25 bg-amber-950/10 backdrop-blur-xl shadow-xl overflow-hidden">
                    <CardContent className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="space-y-0.5">
                                <h3 className="text-base sm:text-lg font-bold text-amber-400 flex items-center gap-2">
                                    <CalendarClock className="h-5 w-5" /> Alertas de Vencimento
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {dueExpenses.totalVencidas > 0 && (
                                        <span><strong className="text-rose-400">{displayAmount(dueExpenses.totalVencidas)}</strong> vencidas</span>
                                    )}
                                    {dueExpenses.totalVencidas > 0 && dueExpenses.totalProximas > 0 && ' • '}
                                    {dueExpenses.totalProximas > 0 && (
                                        <span><strong className="text-amber-400">{displayAmount(dueExpenses.totalProximas)}</strong> nos próximos 7 dias</span>
                                    )}
                                </p>
                            </div>
                            <span className="text-xs font-black uppercase text-slate-400 self-start sm:self-auto">
                                Total: {displayAmount(dueExpenses.totalGeral)}
                            </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {/* Vencidas */}
                            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" /> Vencidas ({dueExpenses.vencidas.length})
                                </p>
                                {dueExpenses.vencidas.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-1">Nenhuma conta atrasada. 🎉</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {dueExpenses.vencidas.slice(0, 4).map((t) => (
                                            <div key={t.id} className="flex items-center justify-between gap-2 bg-[#0a0e1a]/80 rounded-xl px-3 py-2 border border-white/5 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-200 truncate">{t.description}</p>
                                                    <p className="text-[10px] text-rose-400/80">{formatDate(t.date)} • {t._days} dia(s) atrás</p>
                                                </div>
                                                <span className="font-black text-rose-400 shrink-0">{displayAmount(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Próximos 7 Dias */}
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5" /> A Vencer em Breve ({dueExpenses.proximas.length})
                                </p>
                                {dueExpenses.proximas.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-1">Tudo em dia para a semana.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {dueExpenses.proximas.slice(0, 4).map((t) => (
                                            <div key={t.id} className="flex items-center justify-between gap-2 bg-[#0a0e1a]/80 rounded-xl px-3 py-2 border border-white/5 text-xs">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-200 truncate">{t.description}</p>
                                                    <p className="text-[10px] text-amber-400/80">{formatDate(t.date)} • {t._days === 0 ? 'Vence hoje' : `em ${t._days} dia(s)`}</p>
                                                </div>
                                                <span className="font-black text-amber-400 shrink-0">{displayAmount(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                <Card className="border-blue-500/20 bg-blue-950/10 backdrop-blur-md">
                    <CardContent className="p-5 sm:p-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-base sm:text-lg font-bold text-blue-400 flex items-center gap-2">
                                    <Clock className="h-5 w-5" /> Contas Fixas do Mês
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-400">
                                    Pago <span className="text-emerald-400 font-bold">{displayAmount(summary.fixedPaid)}</span> de um total de <span className="text-slate-200 font-bold">{displayAmount(summary.fixedTotal)}</span>.
                                </p>
                            </div>

                            <div className="w-full md:w-1/3 space-y-1.5">
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
                                    <span className="text-slate-400">Progresso</span>
                                    <span className="text-blue-400">{Math.round((summary.fixedPaid / summary.fixedTotal) * 100)}%</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-1000"
                                        style={{ width: `${Math.min((summary.fixedPaid / summary.fixedTotal) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* PAINEL DO CASAL */}
            <Card className="border-indigo-500/20 bg-indigo-950/10 backdrop-blur-md">
                <CardContent className="p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <div className="space-y-0.5">
                            <h3 className="text-base sm:text-lg font-bold text-indigo-300">
                                Painel do Casal ({partner1} & {partner2})
                            </h3>
                            <p className="text-xs text-slate-400">Divisão e acerto de contas compartilhadas</p>
                        </div>
                        <div className="flex items-center gap-2 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold self-start sm:self-auto">
                            <span>{coupleSummary.debtMessage}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-[#0a0e1a]/80 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                            <p className="text-[10px] text-purple-400 uppercase font-black">Gastos de {partner1}</p>
                            <p className="text-lg font-black text-white">{displayAmount(coupleSummary.p1Personal)}</p>
                            <p className="text-[10px] text-slate-400">Exclusivos de {partner1}</p>
                        </div>
                        <div className="bg-[#0a0e1a]/80 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                            <p className="text-[10px] text-rose-400 uppercase font-black">Gastos de {partner2}</p>
                            <p className="text-lg font-black text-white">{displayAmount(coupleSummary.p2Personal)}</p>
                            <p className="text-[10px] text-slate-400">Exclusivos de {partner2}</p>
                        </div>
                        <div className="bg-[#0a0e1a]/80 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                            <p className="text-[10px] text-teal-400 uppercase font-black">Despesas Comuns</p>
                            <p className="text-lg font-black text-white">{displayAmount(coupleSummary.commonTotal)}</p>
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>{partner1}: {displayAmount(coupleSummary.p1CommonPaid)}</span>
                                <span>{partner2}: {displayAmount(coupleSummary.p2CommonPaid)}</span>
                            </div>
                        </div>
                    </div>

                    {(coupleSummary.p1Personal > 0 || coupleSummary.p2Personal > 0) && (
                        <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[11px] font-black uppercase">
                                <span className="text-purple-400">{partner1} ({Math.round(coupleSummary.p1Percent)}%)</span>
                                <span className="text-rose-400">{partner2} ({Math.round(coupleSummary.p2Percent)}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex border border-white/10">
                                <div
                                    className="h-full bg-purple-500 transition-all duration-1000"
                                    style={{ width: `${coupleSummary.p1Percent}%` }}
                                />
                                <div
                                    className="h-full bg-rose-500 transition-all duration-1000"
                                    style={{ width: `${coupleSummary.p2Percent}%` }}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MINI WIDGETS: TAREFAS & DESEJOS */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Mini-Widget: Tarefas Pendentes */}
                <Card className="bg-[#121827]/70 border-white/10 shadow-xl">
                    <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                                    <CheckSquare className="h-4 w-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Tarefas da Casa</h4>
                                    <p className="text-[10px] text-slate-400">
                                        {tasks.filter(t => !t.completed).length} pendentes
                                    </p>
                                </div>
                            </div>
                            {onNavigateTab && (
                                <button
                                    onClick={() => onNavigateTab('tarefas')}
                                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                                >
                                    Ver todas <ArrowRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            {tasks.filter(t => !t.completed).slice(0, 3).map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0e1a]/80 border border-white/5 text-xs">
                                    <span className="font-medium text-slate-200 truncate mr-2">{task.title}</span>
                                    <span className="text-[9px] font-black uppercase text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full shrink-0 border border-cyan-500/20">
                                        {task.assigned_to || 'Casa'}
                                    </span>
                                </div>
                            ))}
                            {tasks.filter(t => !t.completed).length === 0 && (
                                <p className="text-center text-slate-500 text-xs py-3">Tudo concluído! 🎉</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Mini-Widget: Desejos & Compras Planejadas */}
                <Card className="bg-[#121827]/70 border-white/10 shadow-xl">
                    <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <ShoppingBag className="h-4 w-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Desejos & Compras</h4>
                                    <p className="text-[10px] text-slate-400">
                                        {wishlist.filter(w => (w.status || 'planned') === 'planned').length} planejados
                                    </p>
                                </div>
                            </div>
                            {onNavigateTab && (
                                <button
                                    onClick={() => onNavigateTab('desejos')}
                                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                                >
                                    Ver lista <ArrowRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            {wishlist.filter(w => (w.status || 'planned') === 'planned').slice(0, 3).map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0e1a]/80 border border-white/5 text-xs">
                                    <div className="min-w-0 flex-1 mr-2">
                                        <p className="font-medium text-slate-200 truncate">{item.title}</p>
                                        <p className="text-[10px] text-slate-400">{item.category || 'Geral'} • {item.target || 'Casa'}</p>
                                    </div>
                                    <span className="font-bold text-emerald-400 shrink-0">
                                        {item.price > 0 ? displayAmount(item.price) : 'R$ --'}
                                    </span>
                                </div>
                            ))}
                            {wishlist.filter(w => (w.status || 'planned') === 'planned').length === 0 && (
                                <p className="text-center text-slate-500 text-xs py-3">Nenhum item na lista de desejos.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}