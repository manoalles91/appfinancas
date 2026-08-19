'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useMemo } from 'react';
import { CalendarClock, AlertCircle, CalendarDays } from 'lucide-react';

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
    });
};

export default function Dashboard({ transactions = [], allTransactions = [], partner1 = 'Alle', partner2 = 'Kelly' }) {
    const txs = useMemo(() => (Array.isArray(transactions) ? transactions : []), [transactions]);
    const allTxs = useMemo(() => (Array.isArray(allTransactions) ? allTransactions : []), [allTransactions]);

    const summary = useMemo(() => {
        const income = txs
            .filter((t) => t && t.type === 'income')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const checkingPaidExpenses = txs
            .filter((t) => t && t.payment_method === 'checking' && (t.type === 'expense' || t.type === 'credit') && t.pago)
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const balance = income - checkingPaidExpenses;

        const creditExpenses = txs
            .filter((t) => t && t.payment_method === 'credit')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const fixedTotal = txs
            .filter((t) => t && t.fixa)
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const fixedPaid = txs
            .filter((t) => t && t.fixa && t.pago)
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        return { income, balance, creditExpenses, fixedTotal, fixedPaid };
    }, [txs]);

    const financeSummary = useMemo(() => {
        let saldoAtual = 0;
        let pendingIncome = 0;
        let pendingExpense = 0;

        allTxs.forEach((t) => {
            if (!t) return;
            const amt = Number(t.amount || 0);
            if (t.type === 'income') {
                if (t.pago) saldoAtual += amt;
                else pendingIncome += amt;
            } else if (t.type === 'expense' || t.type === 'credit') {
                if (t.pago) saldoAtual -= amt;
                else pendingExpense += amt;
            }
        });

        return {
            saldoAtual,
            previsto: saldoAtual + pendingIncome - pendingExpense,
            pendingIncome,
            pendingExpense,
        };
    }, [allTxs]);

    const dueExpenses = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 7);

        const vencidas = [];
        const proximas = [];

        allTxs.forEach((t) => {
            if (!t || t.pago || (t.type !== 'expense' && t.type !== 'credit') || !t.date) return;
            const d = new Date(t.date + 'T00:00:00');
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
        const p1Personal = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Eu')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p2Personal = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Outro')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const commonTotal = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem && t.quem.startsWith('Comum'))
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p1CommonPaid = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Comum - Eu')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p2CommonPaid = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Comum - Outro')
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

    return (
        <div className="space-y-6">
            {/* Hero: saldo atual + previsto do mês */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#1e293b] to-[#16213a] p-6 md:p-8 shadow-2xl animate-fade-in">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="relative grid gap-8 md:grid-cols-2">
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Saldo Atual</p>
                        <p className={`text-4xl md:text-5xl font-black tracking-tight ${financeSummary.saldoAtual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(financeSummary.saldoAtual)}
                        </p>
                        <p className="text-xs text-slate-500">Tudo que já entrou menos tudo que já saiu.</p>
                    </div>
                    <div className="space-y-1 md:border-l md:border-slate-800 md:pl-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Previsto Fim do Mês</p>
                        <p className={`text-4xl md:text-5xl font-black tracking-tight ${financeSummary.previsto >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                            {formatCurrency(financeSummary.previsto)}
                        </p>
                        <p className="text-xs text-slate-500">
                            Saldo atual + <span className="text-emerald-400 font-bold">{formatCurrency(financeSummary.pendingIncome)}</span> a receber
                            {' '}- <span className="text-red-400 font-bold">{formatCurrency(financeSummary.pendingExpense)}</span> a pagar
                        </p>
                    </div>
                </div>
                <div className="relative mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                    <span>
                        Receitas do mês <strong className="text-emerald-400">+{formatCurrency(summary.income)}</strong>
                    </span>
                    <span>
                        Despesas pagas no mês <strong className="text-red-400">-{formatCurrency(summary.income - summary.balance)}</strong>
                    </span>
                    <span>
                        Fatura cartões <strong className="text-purple-400">{formatCurrency(summary.creditExpenses)}</strong>
                    </span>
                </div>
            </div>

            {/* Despesas com Vencimento */}
            {(dueExpenses.totalVencidas > 0 || dueExpenses.totalProximas > 0) && (
                <Card className="animate-fade-in border-amber-500/20 bg-amber-950/10 backdrop-blur-md">
                    <CardContent className="p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                    <CalendarClock className="h-5 w-5" /> Despesas com Vencimento
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {dueExpenses.totalVencidas > 0 && (
                                        <span><span className="text-red-400 font-bold">{formatCurrency(dueExpenses.totalVencidas)}</span> vencidas</span>
                                    )}
                                    {dueExpenses.totalVencidas > 0 && dueExpenses.totalProximas > 0 && ' • '}
                                    {dueExpenses.totalProximas > 0 && (
                                        <span><span className="text-amber-400 font-bold">{formatCurrency(dueExpenses.totalProximas)}</span> a vencer em até 7 dias</span>
                                    )}
                                </p>
                            </div>
                            <span className="text-xs font-black uppercase text-slate-500">Total: {formatCurrency(dueExpenses.totalGeral)}</span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" /> Vencidas ({dueExpenses.vencidas.length})
                                </p>
                                {dueExpenses.vencidas.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-2">Nenhuma despesa vencida. 🎉</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {dueExpenses.vencidas.slice(0, 5).map((t) => (
                                            <div key={t.id} className="flex items-center justify-between gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-slate-200 truncate">{t.description}</p>
                                                    <p className="text-[10px] text-slate-500">{formatDate(t.date)} • {t._days} dia(s) de atraso</p>
                                                </div>
                                                <span className="text-xs font-bold text-red-400 shrink-0">{formatCurrency(t.amount)}</span>
                                            </div>
                                        ))}
                                        {dueExpenses.vencidas.length > 5 && (
                                            <p className="text-[10px] text-slate-500 text-center pt-1">+ {dueExpenses.vencidas.length - 5} outras vencidas</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5" /> Próximos 7 Dias ({dueExpenses.proximas.length})
                                </p>
                                {dueExpenses.proximas.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-2">Nada vence nos próximos 7 dias.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {dueExpenses.proximas.slice(0, 5).map((t) => (
                                            <div key={t.id} className="flex items-center justify-between gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-slate-200 truncate">{t.description}</p>
                                                    <p className="text-[10px] text-slate-500">{formatDate(t.date)} • em {t._days === 0 ? 'hoje' : `${t._days} dia(s)`}</p>
                                                </div>
                                                <span className="text-xs font-bold text-amber-400 shrink-0">{formatCurrency(t.amount)}</span>
                                            </div>
                                        ))}
                                        {dueExpenses.proximas.length > 5 && (
                                            <p className="text-[10px] text-slate-500 text-center pt-1">+ {dueExpenses.proximas.length - 5} outras</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Fixed Expenses Progress Card */}
            {summary.fixedTotal > 0 && (
                <Card className="animate-fade-in border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2 text-center md:text-left">
                                <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 justify-center md:justify-start">
                                    Compromissos Fixos do Mês
                                </h3>
                                <p className="text-sm text-slate-400">
                                    Você já pagou <span className="text-emerald-400 font-bold">{formatCurrency(summary.fixedPaid)}</span> de um total de <span className="text-slate-200 font-bold">{formatCurrency(summary.fixedTotal)}</span> em contas fixas.
                                </p>
                            </div>

                            <div className="w-full md:w-1/3 space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                    <span className="text-slate-500">Progresso de Pagamento</span>
                                    <span className="text-blue-400">{Math.round((summary.fixedPaid / summary.fixedTotal) * 100)}%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                        style={{ width: `${(summary.fixedPaid / summary.fixedTotal) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Painel do Casal Card */}
            <Card className="animate-fade-in border-indigo-500/20 bg-indigo-950/10 backdrop-blur-md">
                <CardContent className="p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-indigo-400">
                                Painel do Casal ({partner1} & {partner2})
                            </h3>
                            <p className="text-xs text-slate-400">
                                Comparativo de gastos pessoais e acerto de despesas compartilhadas do mês.
                            </p>
                        </div>
                        {coupleSummary.debtAmount > 0 ? (
                            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                                <span>{coupleSummary.debtMessage}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold">
                                <span>{coupleSummary.debtMessage}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 space-y-1">
                            <p className="text-[10px] text-purple-400 uppercase font-black tracking-wider">Gastos Pessoais {partner1}</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(coupleSummary.p1Personal)}</p>
                            <p className="text-[10px] text-slate-500">Exclusivos de {partner1}</p>
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 space-y-1">
                            <p className="text-[10px] text-rose-400 uppercase font-black tracking-wider">Gastos Pessoais {partner2}</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(coupleSummary.p2Personal)}</p>
                            <p className="text-[10px] text-slate-500">Exclusivos de {partner2}</p>
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 space-y-1">
                            <p className="text-[10px] text-teal-400 uppercase font-black tracking-wider">Despesas Comuns</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(coupleSummary.commonTotal)}</p>
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>Pago {partner1}: {formatCurrency(coupleSummary.p1CommonPaid)}</span>
                                <span>Pago {partner2}: {formatCurrency(coupleSummary.p2CommonPaid)}</span>
                            </div>
                        </div>
                    </div>

                    {(coupleSummary.p1Personal > 0 || coupleSummary.p2Personal > 0) && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                <span className="text-purple-400">Proporção {partner1} ({Math.round(coupleSummary.p1Percent)}%)</span>
                                <span className="text-rose-400">{partner2} ({Math.round(coupleSummary.p2Percent)}%)</span>
                            </div>
                            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                                <div
                                    className="h-full bg-purple-500 transition-all duration-1000 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                                    style={{ width: `${coupleSummary.p1Percent}%` }}
                                />
                                <div
                                    className="h-full bg-rose-500 transition-all duration-1000 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                                    style={{ width: `${coupleSummary.p2Percent}%` }}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}