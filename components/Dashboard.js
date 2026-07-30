'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';

const PIE_COLORS = [
    '#818cf8', '#f472b6', '#fb923c', '#34d399',
    '#38bdf8', '#fbbf24', '#a78bfa', '#f87171',
    '#2dd4bf', '#c084fc', '#fb7185', '#4ade80',
];

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-xl border border-white/10 bg-slate-900/90 backdrop-blur-md">
                <p className="font-medium text-slate-300">Dia {label}</p>
                <p className={`font-bold ${payload[0].value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(payload[0].value)}
                </p>
            </div>
        );
    }
    return null;
};

export default function Dashboard({ transactions = [], partner1 = 'Alle', partner2 = 'Kelly' }) {
    const summary = useMemo(() => {
        const txs = Array.isArray(transactions) ? transactions : [];
        const income = txs
            .filter((t) => t && t.type === 'income')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);
        
        const checkingPaidExpenses = txs
            .filter((t) => t && t.payment_method === 'checking' && (t.type === 'expense' || t.type === 'credit') && t.pago)
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const creditExpenses = txs
            .filter((t) => t && t.payment_method === 'credit')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const fixedTotal = txs
            .filter((t) => t && t.fixa)
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);
        
        const fixedPaid = txs
            .filter((t) => t && t.fixa && t.pago)
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() + 7);

        let efetivadas = 0;
        let proximoVencimento = 0;
        let vencidas = 0;
        let distanteVencimento = 0;

        txs.filter(t => t && (t.type === 'expense' || t.type === 'credit')).forEach(t => {
            const amt = Number(t.amount || 0);
            if (t.pago) {
                efetivadas += amt;
            } else {
                const d = new Date(t.date + 'T00:00:00');
                if (d < today) {
                    vencidas += amt;
                } else if (d <= limitDate) {
                    proximoVencimento += amt;
                } else {
                    distanteVencimento += amt;
                }
            }
        });

        const totalDespesasAll = efetivadas + proximoVencimento + vencidas + distanteVencimento;

        return { 
            income, 
            expense: checkingPaidExpenses + creditExpenses, 
            balance: checkingBalance, 
            creditTotal: creditExpenses,
            fixedTotal,
            fixedPaid,
            efetivadas,
            proximoVencimento,
            vencidas,
            distanteVencimento,
            totalDespesasAll
        };
    }, [transactions]);

    const coupleSummary = useMemo(() => {
        const txs = Array.isArray(transactions) ? transactions : [];
        
        // personal expenses
        const p1Personal = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Eu')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p2Personal = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Outro')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        // common expenses
        const commonTotal = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem && t.quem.startsWith('Comum'))
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        // who paid common
        const p1CommonPaid = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Comum - Eu')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const p2CommonPaid = txs
            .filter((t) => t && (t.type === 'expense' || t.type === 'credit') && t.quem === 'Comum - Outro')
            .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const totalCommonPaid = p1CommonPaid + p2CommonPaid;
        const expectedShare = totalCommonPaid / 2;

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
            debtAmount,
            debtor,
            creditor,
            debtMessage,
            p1Percent,
            p2Percent
        };
    }, [transactions, partner1, partner2]);

    const categoryData = useMemo(() => {
        const txs = Array.isArray(transactions) ? transactions : [];
        const map = {};
        txs
            .filter(t => t && (t.type === 'expense' || t.type === 'credit'))
            .forEach(t => {
                const cat = t.category || 'Outros';
                map[cat] = (map[cat] || 0) + (t.amount || 0);
            });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [transactions]);

    const projectionData = useMemo(() => {
        const txs = Array.isArray(transactions) ? transactions : [];
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const data = [];
        let runningBalance = 0;

        const sorted = [...txs].sort((a, b) => new Date(a.date) - new Date(b.date));
        const byDay = {};
        sorted.forEach(t => {
            if (!t || !t.date) return;
            const d = new Date(t.date);
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                const day = d.getDate();
                if (!byDay[day]) byDay[day] = 0;
                byDay[day] += (t.type === 'income' ? (t.amount || 0) : -(t.amount || 0));
            }
        });

        for (let i = 1; i <= daysInMonth; i++) {
            runningBalance += (byDay[i] || 0);
            data.push({ day: i, balance: runningBalance });
        }

        return data;
    }, [transactions]);

    const summaryCards = [
        {
            title: 'Saldo em Conta',
            value: summary.balance,
            icon: Wallet,
            color: summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400',
            glow: summary.balance >= 0 ? 'glow-green' : 'glow-red',
            bgIcon: summary.balance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
        },
        {
            title: 'Receitas',
            value: summary.income,
            icon: TrendingUp,
            color: 'text-emerald-400',
            glow: 'glow-green',
            bgIcon: 'bg-emerald-500/10',
        },
        {
            title: 'Despesas',
            value: summary.expense,
            icon: TrendingDown,
            color: 'text-red-400',
            glow: 'glow-red',
            bgIcon: 'bg-red-500/10',
        },
        {
            title: 'Fatura Cartões',
            value: summary.creditTotal,
            icon: CreditCard,
            color: 'text-purple-400',
            glow: 'glow-purple',
            bgIcon: 'bg-purple-500/10',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.title} className={`${card.glow} animate-fade-in stagger-${i + 1}`}>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.title}</p>
                                        <p className={`text-2xl font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
                                    </div>
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bgIcon}`}>
                                        <Icon className={`h-6 w-6 ${card.color}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            
            {/* Fixed Expenses Progress Card */}
            {summary.fixedTotal > 0 && (
                <Card className="animate-fade-in border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2 text-center md:text-left">
                                <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 justify-center md:justify-start">
                                    📌 Compromissos Fixos do Mês
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
                            <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                                🏡 Painel do Casal ({partner1} & {partner2})
                            </h3>
                            <p className="text-xs text-slate-400">
                                Comparativo de gastos pessoais e acerto de despesas compartilhadas do mês.
                            </p>
                        </div>
                        {coupleSummary.debtAmount > 0 ? (
                            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                                <span>💵 {coupleSummary.debtMessage}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold">
                                <span>🎉 {coupleSummary.debtMessage}</span>
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

                    {/* Comparison bar */}
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

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-5">
                {/* Projection Chart */}
                <Card className="lg:col-span-3 animate-slide-up">
                    <CardHeader>
                        <CardTitle className="text-base">Projeção do Mês</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={projectionData}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="day" fontSize={11} stroke="#555" tickLine={false} axisLine={false} />
                                    <YAxis fontSize={11} stroke="#555" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsla(228,12%,25%,0.3)" vertical={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Category Pie Chart */}
                <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '0.15s' }}>
                    <CardHeader>
                        <CardTitle className="text-base">Despesas por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[220px] w-full">
                            {categoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            dataKey="value"
                                            strokeWidth={0}
                                            paddingAngle={3}
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', background: 'hsl(228,15%,14%)', color: '#eee', fontSize: '12px' }}
                                            formatter={(value) => [formatCurrency(value)]}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px', color: '#aaa' }}
                                            iconType="circle"
                                            iconSize={8}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    Nenhuma despesa registrada.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Discriminação das Despesas Card (Estilo App Exemplo) */}
            <Card className="animate-slide-up border-slate-800 bg-[#1e293b]/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            📊 Discriminação das Despesas
                        </CardTitle>
                        <span className="text-xs font-bold text-slate-400">Total: {formatCurrency(summary.totalDespesasAll)}</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Efetivadas */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-slate-950">
                                    {summary.totalDespesasAll > 0 ? Math.round((summary.efetivadas / summary.totalDespesasAll) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-emerald-300">Efetivadas</span>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-400">{formatCurrency(summary.efetivadas)}</span>
                        </div>

                        {/* Próximo do vencimento */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-slate-950">
                                    {summary.totalDespesasAll > 0 ? Math.round((summary.proximoVencimento / summary.totalDespesasAll) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-amber-300">Próximo ao Vencimento</span>
                            </div>
                            <span className="text-xs font-extrabold text-amber-400">{formatCurrency(summary.proximoVencimento)}</span>
                        </div>

                        {/* Vencidas */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white">
                                    {summary.totalDespesasAll > 0 ? Math.round((summary.vencidas / summary.totalDespesasAll) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-red-300">Vencidas</span>
                            </div>
                            <span className="text-xs font-extrabold text-red-400">{formatCurrency(summary.vencidas)}</span>
                        </div>

                        {/* Distante do vencimento */}
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800 border border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-black text-slate-200">
                                    {summary.totalDespesasAll > 0 ? Math.round((summary.distanteVencimento / summary.totalDespesasAll) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-slate-300">A Vencer (Futuras)</span>
                            </div>
                            <span className="text-xs font-extrabold text-slate-300">{formatCurrency(summary.distanteVencimento)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
