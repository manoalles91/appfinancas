'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowUpRight, ArrowDownLeft, CreditCard, Trash2, ChevronDown, CheckCircle2, Clock, Lock, Pencil, X, Check, Edit3 } from 'lucide-react';

export default function TransactionList({ 
    transactions = [], 
    onDelete, 
    onEdit, 
    onTogglePaid, 
    onAdjustAmount, 
    statusFilter = 'all', 
    onStatusFilterChange, 
    partner1 = 'Alle', 
    partner2 = 'Kelly',
    selectedCardFilter,
    onClearCardFilter,
    viewDate,
    onPayInvoice,
    variaveis = []
}) {
    const [filter, setFilter] = useState('all'); // all | income | expense | credit
    const [spenderFilter, setSpenderFilter] = useState('all'); // all | Eu | Outro | Comum | Filhos
    const [showAllPending, setShowAllPending] = useState(false);
    const [showAllPaid, setShowAllPaid] = useState(false);
    const [adjustFor, setAdjustFor] = useState(null);
    const [adjustValue, setAdjustValue] = useState('');

    const filteredTransactions = useMemo(() => {
        const txs = Array.isArray(transactions) ? transactions : [];
        let list = [...txs].sort((a, b) => {
            const dateA = a && a.date ? new Date(a.date) : new Date(0);
            const dateB = b && b.date ? new Date(b.date) : new Date(0);
            return dateB - dateA;
        });
        
        if (selectedCardFilter) {
            list = list.filter(t => t && t.card_name === selectedCardFilter);
        } else if (filter !== 'all') {
            list = list.filter(t => t && t.type === filter);
        }

        if (spenderFilter === 'Eu') {
            list = list.filter(t => t && (t.quem === 'Eu' || t.quem === 'Comum - Eu'));
        } else if (spenderFilter === 'Outro') {
            list = list.filter(t => t && (t.quem === 'Outro' || t.quem === 'Comum - Outro'));
        } else if (spenderFilter === 'Comum') {
            list = list.filter(t => t && t.quem && t.quem.startsWith('Comum'));
        } else if (spenderFilter === 'Filhos') {
            list = list.filter(t => t && (t.quem === 'Filhos' || t.quem === 'Comum - Filhos'));
        }

        if (viewDate) {
            list = list.filter(t => {
                if (!t || !t.date) return false;
                const d = new Date(t.date);
                return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
            });
        }

        return list;
    }, [transactions, filter, spenderFilter, selectedCardFilter, viewDate]);

    const pendingList = useMemo(() => filteredTransactions.filter(t => !t.pago), [filteredTransactions]);
    const paidList = useMemo(() => filteredTransactions.filter(t => t.pago), [filteredTransactions]);

    const isVariavel = (t) => t && t.fixa && Array.isArray(variaveis) && variaveis.includes(t.description);

    const consolidateCards = (list) => {
        const cards = {};
        const rest = [];
        list.forEach(t => {
            if (t && t.type === 'credit' && t.card_name) {
                (cards[t.card_name] = cards[t.card_name] || []).push(t);
            } else {
                rest.push(t);
            }
        });
        return [
            ...rest,
            ...Object.entries(cards).map(([cardName, items]) => ({
                __cardRow: true,
                id: 'card|' + cardName,
                card_name: cardName,
                items,
                amount: items.reduce((a, t) => a + Number(t.amount || 0), 0),
                allPaid: items.every(t => t.pago),
            })),
        ];
    };

    const pendingDisplay = useMemo(() => consolidateCards(pendingList), [pendingList]);
    const paidDisplay = useMemo(() => consolidateCards(paidList), [paidList]);

    const sum = (list) => list.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const pendingTotal = sum(pendingList);
    const paidTotal = sum(paidList);
    const grandTotal = pendingTotal + paidTotal;
    const paidRatio = grandTotal > 0 ? Math.round((paidTotal / grandTotal) * 100) : 0;

    const showPending = statusFilter === 'all' || statusFilter === 'pending';
    const showPaid = statusFilter === 'all' || statusFilter === 'paid';

    const displayedPending = showAllPending ? pendingDisplay : pendingDisplay.slice(0, 15);
    const displayedPaid = showAllPaid ? paidDisplay : paidDisplay.slice(0, 15);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value || 0);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
        });
    };

    const typeConfig = {
        income: { icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/10', sign: '+' },
        expense: { icon: ArrowDownLeft, color: 'text-red-400', bg: 'bg-red-500/10', sign: '-' },
        credit: { icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10', sign: '-' },
    };

    const filterButtons = [
        { value: 'all', label: 'Todos' },
        { value: 'income', label: 'Receitas' },
        { value: 'expense', label: 'Despesas' },
        { value: 'credit', label: 'Cartão' },
    ];

    const isOverdue = (t) => {
        if (t.pago || t.type === 'credit') return false;
        if (!t.date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(t.date);
        due.setHours(0, 0, 0, 0);
        return due < today;
    };

    const getSpenderBadge = (quem) => {
        if (quem === 'Eu') {
            return <span className="text-[9px] font-black uppercase bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/25">{partner1}</span>;
        }
        if (quem === 'Outro') {
            return <span className="text-[9px] font-black uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/25">{partner2}</span>;
        }
        if (quem === 'Comum - Eu') {
            return <span className="text-[9px] font-black uppercase bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/25">Comum ({partner1})</span>;
        }
        if (quem === 'Comum - Outro') {
            return <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/25">Comum ({partner2})</span>;
        }
        if (quem === 'Filhos' || quem === 'Comum - Filhos') {
            return <span className="text-[9px] font-black uppercase bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/25">👶 Filhos</span>;
        }
        if (quem === 'Comum') {
            return <span className="text-[9px] font-black uppercase bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/25">Comum</span>;
        }
        return null;
    };

    const renderItem = (t) => {
        if (t.__cardRow) {
            return (
                <div key={t.id} className="group flex items-center justify-between rounded-lg p-3 border border-purple-500/25 bg-purple-500/10 transition-all duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => onPayInvoice && onPayInvoice(t.card_name, !t.allPaid)}
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer hover:scale-110 ${
                                t.allPaid ? 'bg-emerald-500/20 hover:bg-emerald-500/30' : 'bg-amber-500/10 hover:bg-amber-500/30'
                            }`}
                            title={t.allPaid ? 'Reabrir fatura' : 'Pagar fatura inteira'}
                        >
                            {t.allPaid ? (
                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            ) : (
                                <Clock className="h-6 w-6 text-amber-500" />
                            )}
                        </button>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-purple-300 truncate flex items-center gap-1.5">
                                <CreditCard className="h-3.5 w-3.5" /> Fatura {t.card_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {t.items.length} {t.items.length === 1 ? 'compra' : 'compras'} no mês
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-sm font-semibold ${t.allPaid ? 'text-slate-400' : 'text-purple-400'}`}>
                            -{formatCurrency(t.amount)}
                        </span>
                    </div>
                </div>
            );
        }

        const config = typeConfig[t.type] || typeConfig.expense;
        const isPaid = t.pago;
        const overdue = isOverdue(t);

        return (
            <div
                key={t.id}
                className={`group flex items-center justify-between rounded-lg p-3 transition-all duration-200 ${
                    isPaid ? 'bg-secondary/10 opacity-80' : 'hover:bg-secondary/30'
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <button 
                        onClick={() => {
                            if (!isPaid && (t.installment_info || isVariavel(t)) && onAdjustAmount) {
                                setAdjustFor(t);
                                setAdjustValue(String(Number(t.amount || 0).toFixed(2)).replace(',', '.'));
                            } else {
                                onTogglePaid && onTogglePaid(t.id, !isPaid);
                            }
                        }}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer hover:scale-110 ${
                            isPaid ? 'bg-emerald-500/20 hover:bg-emerald-500/30' : 'bg-amber-500/10 hover:bg-amber-500/30'
                        }`}
                        title={isPaid ? "Marcar como pendente" : ((t.installment_info || isVariavel(t)) ? "Pagar (digite o valor real)" : "Marcar como PAGO ✓")}
                    >
                        {isPaid ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                            <Clock className="h-6 w-6 text-amber-500" />
                        )}
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium leading-tight truncate ${isPaid ? 'text-slate-400 line-through decoration-slate-500/50' : ''}`}>
                                {t.description}
                            </p>
                            {getSpenderBadge(t.quem)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">{t.category}</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                            {t.installment_info && (
                                <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded">
                                        {t.installment_info}
                                    </span>
                                </>
                            )}
                            {t.fixa && (
                                <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                    FIXA
                                </span>
                            )}
                            {overdue && (
                                <span className="text-[9px] font-black uppercase text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                    VENCIDA
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-sm font-semibold ${isPaid ? 'text-slate-500' : config.color}`}>
                        {config.sign}{formatCurrency(t.amount)}
                    </span>
                    {onEdit && (
                        <button
                            onClick={() => onEdit(t)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700/50 cursor-pointer text-slate-400 hover:text-white"
                            title="Editar"
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(t.id, { transaction: t })}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 cursor-pointer"
                            title="Excluir"
                        >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const monthLabel = (key) => {
        const d = new Date(key + '-01T00:00:00');
        return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
    };

    const groupByMonth = (list) => {
        const groups = {};
        list.forEach(t => {
            const key = t.date ? t.date.slice(0, 7) : 'sem-data';
            (groups[key] = groups[key] || []).push(t);
        });
        return Object.keys(groups)
            .sort((a, b) => a === 'sem-data' ? 1 : b === 'sem-data' ? -1 : a.localeCompare(b))
            .map(key => ({ key, label: key === 'sem-data' ? 'Sem data' : monthLabel(key), items: groups[key] }));
    };

    const renderSection = (title, emoji, items, total, count, showAll, setShowAll, accentText, accentValue, groupByMonthFlag) => {
        if (items.length === 0 && count === 0) return null;
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${accentText}`}>
                        {emoji} {title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {count} {count === 1 ? 'item' : 'itens'} • <span className={`font-bold ${accentValue}`}>{formatCurrency(total)}</span>
                    </span>
                </div>
                <div className="space-y-2">
                    {groupByMonthFlag ? (
                        groupByMonth(items).map(g => (
                            <div key={g.key} className="space-y-2">
                                <div className="flex items-center justify-between px-1 pt-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/80">📅 {g.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {g.items.length} {g.items.length === 1 ? 'item' : 'itens'} • <span className="font-bold text-amber-300">{formatCurrency(sum(g.items))}</span>
                                    </span>
                                </div>
                                <div className="space-y-2">{g.items.map(renderItem)}</div>
                            </div>
                        ))
                    ) : (
                        items.map(renderItem)
                    )}
                </div>
                {count > 15 && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all cursor-pointer"
                    >
                        Ver todas ({count}) <ChevronDown className="h-3 w-3" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <Card className="animate-slide-up">
            <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Transações</CardTitle>
                    {selectedCardFilter && (
                        <button
                            onClick={onClearCardFilter}
                            className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 cursor-pointer"
                        >
                            Filtro: {selectedCardFilter} <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">⏳ A Pagar</p>
                            <p className="text-lg font-bold text-amber-300 leading-tight">{formatCurrency(pendingTotal)}</p>
                            <p className="text-[10px] text-amber-400/70">{pendingList.length} {pendingList.length === 1 ? 'item' : 'itens'}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">✅ Pagas</p>
                            <p className="text-lg font-bold text-emerald-300 leading-tight">{formatCurrency(paidTotal)}</p>
                            <p className="text-[10px] text-emerald-400/70">{paidList.length} {paidList.length === 1 ? 'item' : 'itens'}</p>
                        </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500/70 to-emerald-400 transition-all duration-500"
                            style={{ width: `${paidRatio}%` }}
                        />
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {filterButtons.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => { setFilter(f.value); setShowAllPending(false); setShowAllPaid(false); }}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${filter === f.value
                                        ? 'bg-primary/20 text-primary border border-primary/30'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 p-1 rounded-xl bg-slate-900/50 border border-slate-800">
                        {[
                            { value: 'all', label: `📄 Todas (${filteredTransactions.length})` },
                            { value: 'pending', label: `⏳ A Pagar (${pendingList.length})` },
                            { value: 'paid', label: `✅ Pagas (${paidList.length})` }
                        ].map((s) => (
                            <button
                                key={s.value}
                                onClick={() => { onStatusFilterChange && onStatusFilterChange(s.value); setShowAllPending(false); setShowAllPaid(false); }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                    statusFilter === s.value 
                                    ? 'bg-slate-800 text-white shadow-lg border border-slate-700' 
                                    : 'text-slate-500 hover:text-slate-400'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar mt-1 bg-slate-900/35 p-1 rounded-xl border border-slate-800/40">
                        {[
                            { value: 'all', label: '👥 Todos' },
                            { value: 'Eu', label: `Pessoal ${partner1}` },
                            { value: 'Outro', label: `Pessoal ${partner2}` },
                            { value: 'Comum', label: '🏡 Comum' },
                            { value: 'Filhos', label: '👶 Filhos' }
                        ].map((sf) => (
                            <button
                                key={sf.value}
                                onClick={() => { setSpenderFilter(sf.value); setShowAllPending(false); setShowAllPaid(false); }}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                    spenderFilter === sf.value
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-300'
                                }`}
                            >
                                {sf.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {adjustFor && (
                    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-3 animate-fade-in">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{adjustFor.description}</p>
                                <p className="text-[10px] text-amber-300/70">
                                    {adjustFor.installment_info
                                        ? `Parcela (${adjustFor.installment_info}) • pode haver diferença de centavos por TR/seguros`
                                        : 'Conta variável • digite o valor real do boleto (luz, água, etc.)'}
                                </p>
                            </div>
                            <button
                                onClick={() => setAdjustFor(null)}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Valor real do boleto (R$)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={adjustValue}
                                    onChange={(e) => setAdjustValue(e.target.value)}
                                    className="bg-slate-900/60 border-amber-500/40"
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    const v = parseFloat(String(adjustValue).replace(',', '.')) || 0;
                                    if (v > 0) {
                                        await onAdjustAmount(adjustFor.id, Math.round(v * 100) / 100);
                                    }
                                    await onTogglePaid(adjustFor.id, true);
                                    setAdjustFor(null);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-black hover:bg-amber-400 transition-all cursor-pointer"
                            >
                                <Check className="h-3.5 w-3.5" /> Pagar
                            </button>
                        </div>
                    </div>
                )}
                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                    {showPending && renderSection('A Pagar', '⏳', displayedPending, pendingTotal, pendingDisplay.length, showAllPending, setShowAllPending, 'text-amber-400', 'text-amber-300', false)}
                    {showPaid && renderSection('Pagas', '✅', displayedPaid, paidTotal, paidDisplay.length, showAllPaid, setShowAllPaid, 'text-emerald-400', 'text-emerald-300', false)}
                    {pendingDisplay.length === 0 && paidDisplay.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-8">Nenhuma transação encontrada.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}