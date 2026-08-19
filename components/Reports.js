'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMemo } from 'react';
import { CATEGORY_GROUPS, getGroupId, getCategories } from '@/lib/categories';

const GROUP_COLORS = {
    essenciais: '#60a5fa',
    estilo_vida: '#f472b6',
    investimentos: '#34d399',
    renda: '#fbbf24',
};

const GROUP_EMOJI = {
    essenciais: '🏠',
    estilo_vida: '🎮',
    investimentos: '📈',
    renda: '💵',
};

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

export default function Reports({ transactions = [] }) {
    const txs = useMemo(() => (Array.isArray(transactions) ? transactions : []), [transactions]);

    const summary = useMemo(() => {
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

        return { efetivadas, proximoVencimento, vencidas, distanteVencimento, total: efetivadas + proximoVencimento + vencidas + distanteVencimento };
    }, [txs]);

    const categoryData = useMemo(() => {
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
    }, [txs]);

    const groupData = useMemo(() => {
        const groups = getCategories();
        const totals = {};
        let total = 0;
        txs
            .filter(t => t && (t.type === 'expense' || t.type === 'credit'))
            .forEach(t => {
                const amt = Number(t.amount || 0);
                total += amt;
                const groupId = getGroupId(t.category) || 'outros';
                totals[groupId] = (totals[groupId] || 0) + amt;
            });
        return {
            totals,
            total,
            groups: groups
                .filter(g => totals[g.id])
                .map(g => ({ ...g, value: totals[g.id], percent: total > 0 ? (totals[g.id] / total) * 100 : 0 }))
                .sort((a, b) => b.value - a.value),
        };
    }, [txs]);

    const projectionData = useMemo(() => {
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
    }, [txs]);

    return (
        <div className="space-y-6">
            {groupData.groups.length > 0 && (
                <Card className="animate-slide-up border-indigo-500/20 bg-indigo-950/10">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Despesas por Grupo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {groupData.groups.map((g) => (
                                <div key={g.id} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-black uppercase tracking-wider" style={{ color: GROUP_COLORS[g.id] || '#94a3b8' }}>
                                            {GROUP_EMOJI[g.id] || ''} {g.label}
                                        </p>
                                        <p className="text-xs font-extrabold text-slate-200">{Math.round(g.percent)}%</p>
                                    </div>
                                    <p className="text-xl font-black text-white">{formatCurrency(g.value)}</p>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-1000"
                                            style={{ width: `${Math.min(g.percent, 100)}%`, backgroundColor: GROUP_COLORS[g.id] || '#94a3b8' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-5">
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

            <Card className="animate-slide-up border-slate-800 bg-[#1e293b]/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Discriminação das Despesas</CardTitle>
                        <span className="text-xs font-bold text-slate-400">Total: {formatCurrency(summary.total)}</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-slate-950">
                                    {summary.total > 0 ? Math.round((summary.efetivadas / summary.total) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-emerald-300">Efetivadas</span>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-400">{formatCurrency(summary.efetivadas)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-slate-950">
                                    {summary.total > 0 ? Math.round((summary.proximoVencimento / summary.total) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-amber-300">Próximo ao Vencimento</span>
                            </div>
                            <span className="text-xs font-extrabold text-amber-400">{formatCurrency(summary.proximoVencimento)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white">
                                    {summary.total > 0 ? Math.round((summary.vencidas / summary.total) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-red-300">Vencidas</span>
                            </div>
                            <span className="text-xs font-extrabold text-red-400">{formatCurrency(summary.vencidas)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800 border border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-black text-slate-200">
                                    {summary.total > 0 ? Math.round((summary.distanteVencimento / summary.total) * 100) : 0}%
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