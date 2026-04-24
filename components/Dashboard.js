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

export default function Dashboard({ transactions = [] }) {
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

        const checkingBalance = income - checkingPaidExpenses;
        
        return { 
            income, 
            expense: checkingPaidExpenses + creditExpenses, 
            balance: checkingBalance, 
            creditTotal: creditExpenses,
            fixedTotal,
            fixedPaid
        };
    }, [transactions]);

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
        </div>
    );
}
