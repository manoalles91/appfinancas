'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    ArrowUpRight, 
    ArrowDownLeft, 
    CreditCard, 
    Trash2, 
    ChevronDown, 
    CheckCircle2, 
    Clock, 
    X, 
    Edit3, 
    Search
} from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { formatCurrency, formatDate, parseLocalDate } from '@/lib/format';

export default function TransactionList({ 
    transactions = [], 
    cardsSummary = [],
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
    selectedFaturaFilter,
    onPayInvoice,
    variaveis = [],
    isPrivate = false
}) {
    const [filter, setFilter] = useState('all'); // all | income | expense | credit
    const [spenderFilter, setSpenderFilter] = useState('all'); // all | Eu | Outro | Comum | Filhos
    const [searchTerm, setSearchTerm] = useState('');
    const [adjustFor, setAdjustFor] = useState(null);
    const [adjustValue, setAdjustValue] = useState('');
    const [showAllPendingIncome, setShowAllPendingIncome] = useState(false);
    const [showAllPaidIncome, setShowAllPaidIncome] = useState(false);
    const [showAllPendingExpense, setShowAllPendingExpense] = useState(false);
    const [showAllPaidExpense, setShowAllPaidExpense] = useState(false);

    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => {
            const dateA = a && a.date ? (parseLocalDate(a.date) || new Date(0)) : new Date(0);
            const dateB = b && b.date ? (parseLocalDate(b.date) || new Date(0)) : new Date(0);
            return dateB - dateA;
        });
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        let list = sortedTransactions;

        if (filter !== 'all') {
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

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(t => 
                (t.description || '').toLowerCase().includes(term) ||
                (t.category || '').toLowerCase().includes(term) ||
                (t.subcategoria || '').toLowerCase().includes(term) ||
                (t.card_name || '').toLowerCase().includes(term)
            );
        }

        if (viewDate) {
            list = list.filter(t => {
                if (!t || !t.date) return false;
                const d = parseLocalDate(t.date);
                if (!d) return false;
                return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
            });
        }

        if (selectedFaturaFilter) {
            list = list.filter(t => {
                if (!t || !t.date) return false;
                const d = parseLocalDate(t.date);
                if (!d) return false;
                const matchesFaturaMonth = d.getMonth() === selectedFaturaFilter.month;
                const matchesFaturaYear = d.getFullYear() === selectedFaturaFilter.year;
                const matchesFaturaCard = t.card_name === selectedFaturaFilter.cardNome;
                return matchesFaturaMonth && matchesFaturaYear && matchesFaturaCard;
            });
        }

        return list;
    }, [sortedTransactions, filter, spenderFilter, searchTerm, viewDate, selectedFaturaFilter]);

    const pendingList = useMemo(() => filteredTransactions.filter(t => !t.pago), [filteredTransactions]);
    const paidList = useMemo(() => filteredTransactions.filter(t => t.pago), [filteredTransactions]);

    const isVariavel = (t) => t && t.fixa && Array.isArray(variaveis) && variaveis.includes(t.description);

    const consolidateCards = useCallback((list, isPaidContext = false) => {
        const cards = {};
        const rest = [];
        list.forEach(t => {
            if (t && t.type === 'credit' && t.card_name) {
                (cards[t.card_name] = cards[t.card_name] || []).push(t);
            } else {
                rest.push(t);
            }
        });

        const cardsSummaryList = Array.isArray(cardsSummary) ? cardsSummary : [];
        const cardItems = Object.entries(cards).map(([cardName, items]) => {
            const cardInfo = cardsSummaryList.find(c => c && c.nome === cardName);
            const allPaid = cardInfo ? !!cardInfo.isPaga : items.every(t => t.pago);
            const total = cardInfo && cardInfo.faturaAtual != null 
                ? Number(cardInfo.faturaAtual || 0) 
                : items.reduce((acc, t) => acc + Number(t.amount || 0), 0);

            return {
                id: `card-group-${cardName}-${isPaidContext ? 'paid' : 'pending'}`,
                isCardGroup: true,
                cardName,
                total,
                items,
                allPaid,
                isPaga: cardInfo ? !!cardInfo.isPaga : allPaid,
                isAjustada: cardInfo ? !!cardInfo.isAjustada : false,
            };
        });

        return [...cardItems, ...rest];
    }, [cardsSummary]);

    const consolidatedPending = useMemo(() => consolidateCards(pendingList, false), [pendingList, consolidateCards]);
    const consolidatedPaid = useMemo(() => consolidateCards(paidList, true), [paidList, consolidateCards]);

    const sum = (arr) => arr.reduce((acc, t) => {
        if (t.isCardGroup) return acc + Number(t.total || 0);
        return acc + Number(t.amount || 0);
    }, 0);

    const pendingExpenses = useMemo(() => pendingList.filter(t => t.type !== 'income'), [pendingList]);
    const paidExpenses = useMemo(() => paidList.filter(t => t.type !== 'income'), [paidList]);

    const pendingIncome = useMemo(() => pendingList.filter(t => t.type === 'income'), [pendingList]);
    const paidIncome = useMemo(() => paidList.filter(t => t.type === 'income'), [paidList]);

    const pendingExpensesDisplay = useMemo(() => consolidatedPending.filter(t => t.type !== 'income'), [consolidatedPending]);
    const paidExpensesDisplay = useMemo(() => consolidatedPaid.filter(t => t.type !== 'income'), [consolidatedPaid]);

    const pendingIncomeDisplay = useMemo(() => pendingIncome, [pendingIncome]);
    const paidIncomeDisplay = useMemo(() => paidIncome, [paidIncome]);

    const pendingExpenseTotal = useMemo(() => sum(pendingExpensesDisplay), [pendingExpensesDisplay]);
    const paidExpenseTotal = useMemo(() => sum(paidExpensesDisplay), [paidExpensesDisplay]);
    const pendingIncomeTotal = useMemo(() => sum(pendingIncomeDisplay), [pendingIncomeDisplay]);
    const paidIncomeTotal = useMemo(() => sum(paidIncomeDisplay), [paidIncomeDisplay]);

    const isIncomeFilter = filter === 'income';
    const totalCurrentPeriod = isIncomeFilter 
        ? pendingIncomeTotal + paidIncomeTotal 
        : pendingExpenseTotal + paidExpenseTotal;

    const percentCurrentPeriod = totalCurrentPeriod > 0 
        ? Math.round(((isIncomeFilter ? paidIncomeTotal : paidExpenseTotal) / totalCurrentPeriod) * 100) 
        : 0;

    const displayAmount = (val) => {
        if (isPrivate) return '••••••';
        return formatCurrency(val);
    };

    const typeConfig = {
        expense: { color: 'text-rose-400', sign: '-' },
        income: { color: 'text-emerald-400', sign: '+' },
        credit: { color: 'text-purple-400', sign: '-' },
    };

    const typeFilterButtons = [
        { value: 'all', label: 'Todos' },
        { value: 'expense', label: 'Despesas' },
        { value: 'income', label: 'Receitas' },
        { value: 'credit', label: 'Cartões' },
    ];

    const isOverdue = (t) => {
        if (t.pago || t.type === 'credit') return false;
        if (!t.date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = parseLocalDate(t.date);
        if (!due) return false;
        due.setHours(0, 0, 0, 0);
        return due < today;
    };

    const getSpenderBadge = (quem) => {
        if (quem === 'Eu') {
            return <span className="text-[8px] sm:text-[9px] font-black uppercase bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">{partner1}</span>;
        }
        if (quem === 'Outro') {
            return <span className="text-[8px] sm:text-[9px] font-black uppercase bg-rose-500/15 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">{partner2}</span>;
        }
        if (quem === 'Comum - Eu') {
            return <span className="text-[8px] sm:text-[9px] font-black uppercase bg-teal-500/15 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/30">Comum ({partner1})</span>;
        }
        if (quem === 'Comum - Outro') {
            return <span className="text-[8px] sm:text-[9px] font-black uppercase bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">Comum ({partner2})</span>;
        }
        if (quem === 'Filhos' || quem === 'Comum - Filhos') {
            return <span className="text-[8px] sm:text-[9px] font-black uppercase bg-cyan-500/15 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">👶 Filhos</span>;
        }
        if (quem === 'Comum') {
            return <span className="text-[8px] sm:text-[9px] font-black uppercase bg-slate-500/15 text-slate-300 px-1.5 py-0.5 rounded border border-slate-500/30">Comum</span>;
        }
        return null;
    };

    const renderItem = (t) => {
        if (t.__cardRow) {
            return (
                <div key={t.id} className="group flex items-center justify-between rounded-xl p-2.5 sm:p-3 border border-purple-500/20 bg-purple-500/10 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            onClick={() => onPayInvoice && onPayInvoice(t.card_name, !t.allPaid)}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer active:scale-90 ${
                                t.allPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}
                            title={t.allPaid ? 'Reabrir fatura' : 'Pagar fatura inteira'}
                        >
                            {t.allPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-purple-200 truncate flex items-center gap-1">
                                <CreditCard className="h-3.5 w-3.5 text-purple-400 shrink-0" /> Fatura {t.card_name}
                                {t.isAjustada && (
                                    <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                                        AJUSTADA
                                    </span>
                                )}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                {t.items.length > 0 ? `${t.items.length} compras no mês` : 'Fatura ajustada'}
                            </p>
                        </div>
                    </div>
                    <span className={`text-xs sm:text-sm font-black shrink-0 ml-1.5 ${t.allPaid ? 'text-slate-500 line-through' : 'text-purple-300'}`}>
                        -{displayAmount(t.amount)}
                    </span>
                </div>
            );
        }

        const config = typeConfig[t.type] || typeConfig.expense;
        const isPaid = t.pago;
        const overdue = isOverdue(t);

        return (
            <div
                key={t.id}
                className={`group flex items-center justify-between rounded-xl p-2.5 sm:p-3 border transition-all ${
                    isPaid 
                        ? 'bg-[#121827]/40 border-white/5 opacity-75' 
                        : 'bg-[#121827]/80 hover:bg-[#121827] border-white/10 shadow-sm'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button 
                        onClick={() => {
                            if (!isPaid && (t.installment_info || isVariavel(t)) && onAdjustAmount) {
                                setAdjustFor(t);
                                setAdjustValue(String(Number(t.amount || 0).toFixed(2)).replace(',', '.'));
                            } else {
                                onTogglePaid && onTogglePaid(t.id, !isPaid);
                            }
                        }}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer active:scale-90 ${
                            isPaid 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/15 text-amber-400'
                        }`}
                        title={isPaid ? "Marcar como pendente" : "Marcar como PAGO"}
                    >
                        {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`text-xs sm:text-sm font-bold text-slate-100 truncate max-w-[170px] sm:max-w-none ${isPaid ? 'line-through text-slate-400' : ''}`}>
                                {t.description}
                            </p>
                            {getSpenderBadge(t.quem)}
                        </div>

                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-0.5 truncate">
                                <CategoryIcon category={t.category} size="xs" />
                                {t.category}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span>{formatDate(t.date)}</span>
                            {t.installment_info && (
                                <span className="text-[8px] font-black text-indigo-300 bg-indigo-500/15 px-1 py-0.2 rounded">
                                    {t.installment_info}
                                </span>
                            )}
                            {overdue && (
                                <span className="text-[8px] font-black text-rose-300 bg-rose-500/15 px-1 py-0.2 rounded">
                                    VENCIDA
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1.5">
                    <span className={`text-xs sm:text-sm font-black ${isPaid ? 'text-slate-400' : config.color}`}>
                        {config.sign}{displayAmount(t.amount)}
                    </span>

                    {/* Compact actions */}
                    <div className="flex items-center">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(t)}
                                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer active:scale-90"
                                title="Editar"
                            >
                                <Edit3 className="h-3 w-3" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(t)}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer active:scale-90"
                                title="Excluir"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSection = (title, emoji, items, total, count, showAll, setShowAll, accentText, accentValue) => {
        if (items.length === 0 && count === 0) return null;
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                    <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${accentText} flex items-center gap-1`}>
                        <span>{emoji}</span> {title}
                    </span>
                    <span className="text-[11px] text-slate-400">
                        {count} {count === 1 ? 'item' : 'itens'} • <span className={`font-black ${accentValue}`}>{displayAmount(total)}</span>
                    </span>
                </div>
                <div className="space-y-1.5">
                    {items.map(renderItem)}
                </div>
                {count > 15 && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold text-slate-400 hover:text-white bg-white/5 transition-all cursor-pointer"
                    >
                        Ver todas ({count}) <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <Card className="border-white/10 bg-[#0f172a]/90 backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-3xl">
            <CardHeader className="space-y-2.5 p-3.5 sm:p-5 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                        📄 Extrato & Lançamentos
                    </CardTitle>
                    {selectedCardFilter && (
                        <button
                            onClick={onClearCardFilter}
                            className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30 cursor-pointer"
                        >
                            Filtro: {selectedCardFilter} <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar lançamento, cartão ou categoria..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-white/10 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Summary Metrics Banner */}
                <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                        {isIncomeFilter ? (
                            <>
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                                    <p className="text-[9px] font-black uppercase text-emerald-400">⏳ A Receber</p>
                                    <p className="text-sm sm:text-base font-black text-emerald-300">{displayAmount(pendingIncomeTotal)}</p>
                                </div>
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                                    <p className="text-[9px] font-black uppercase text-emerald-400">✅ Recebidas</p>
                                    <p className="text-sm sm:text-base font-black text-emerald-300">{displayAmount(paidIncomeTotal)}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2">
                                    <p className="text-[9px] font-black uppercase text-amber-400">⏳ A Pagar</p>
                                    <p className="text-sm sm:text-base font-black text-amber-300">{displayAmount(pendingExpenseTotal)}</p>
                                </div>
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                                    <p className="text-[9px] font-black uppercase text-emerald-400">✅ Pagas</p>
                                    <p className="text-sm sm:text-base font-black text-emerald-300">{displayAmount(paidExpenseTotal)}</p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${paidRatio}%` }}
                        />
                    </div>
                </div>

                {/* Filter Chips 1: Type */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                    {filterButtons.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => { setFilter(f.value); setShowAllPending(false); setShowAllPaid(false); }}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                filter === f.value
                                    ? 'bg-indigo-600 text-white shadow-sm border border-indigo-400/30'
                                    : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Filter Chips 2: Status */}
                <div className="flex gap-1 p-0.5 rounded-xl bg-[#0a0e1a] border border-white/10">
                    {[
                        { value: 'all', label: 'Todos' },
                        { value: 'pending', label: '⏳ Pendentes' },
                        { value: 'paid', label: '✅ Pagos' },
                    ].map((s) => (
                        <button
                            key={s.value}
                            onClick={() => onStatusFilterChange(s.value)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                statusFilter === s.value
                                    ? 'bg-white/15 text-white font-black'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Filter Chips 3: Quem */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                    {[
                        { value: 'all', label: 'Todos' },
                        { value: 'Comum', label: '🏡 Comum' },
                        { value: 'Eu', label: `💜 ${partner1}` },
                        { value: 'Outro', label: `💖 ${partner2}` },
                        { value: 'Filhos', label: '👶 Filhos' },
                    ].map((sp) => (
                        <button
                            key={sp.value}
                            onClick={() => setSpenderFilter(sp.value)}
                            className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                spenderFilter === sp.value
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                        >
                            {sp.label}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="p-3.5 sm:p-5 pt-1 space-y-4">
                {isIncomeFilter ? (
                    <>
                        {(statusFilter === 'all' || statusFilter === 'pending') && renderSection(
                            'Receitas Previstas (A Receber)',
                            '⏳',
                            showAllPendingIncome ? pendingIncomeDisplay : pendingIncomeDisplay.slice(0, 15),
                            pendingIncomeTotal,
                            pendingIncomeDisplay.length,
                            showAllPendingIncome,
                            setShowAllPendingIncome,
                            'text-amber-400',
                            'text-amber-400'
                        )}
                        {(statusFilter === 'all' || statusFilter === 'paid') && renderSection(
                            'Receitas Confirmadas',
                            '✅',
                            showAllPaidIncome ? paidIncomeDisplay : paidIncomeDisplay.slice(0, 15),
                            paidIncomeTotal,
                            paidIncomeDisplay.length,
                            showAllPaidIncome,
                            setShowAllPaidIncome,
                            'text-emerald-400',
                            'text-emerald-400'
                        )}
                    </>
                ) : (
                    <>
                        {(statusFilter === 'all' || statusFilter === 'pending') && renderSection(
                            'Contas Pendentes / A Pagar',
                            '⏳',
                            showAllPending ? pendingExpenseDisplay : pendingExpenseDisplay.slice(0, 15),
                            pendingExpenseTotal,
                            pendingExpenseDisplay.length,
                            showAllPending,
                            setShowAllPending,
                            'text-amber-400',
                            'text-amber-400'
                        )}
                        {(statusFilter === 'all' || statusFilter === 'paid') && renderSection(
                            'Contas Pagas & Concluídas',
                            '✅',
                            showAllPaid ? paidExpenseDisplay : paidExpenseDisplay.slice(0, 15),
                            paidExpenseTotal,
                            paidExpenseDisplay.length,
                            showAllPaid,
                            setShowAllPaid,
                            'text-emerald-400',
                            'text-emerald-400'
                        )}
                    </>
                )}

                {filteredTransactions.length === 0 && (
                    <div className="py-8 text-center text-slate-500 text-xs">
                        Nenhum lançamento encontrado com os filtros selecionados.
                    </div>
                )}
            </CardContent>

            {/* Modal de Ajuste de Valor Real ao Pagar */}
            {adjustFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#121827] border border-white/15 w-full max-w-sm rounded-2xl shadow-2xl p-4 space-y-3 animate-scale-in">
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <h3 className="text-sm font-bold text-white">Confirmar Valor ao Pagar</h3>
                            <button onClick={() => setAdjustFor(null)} className="text-slate-400 hover:text-white p-1">✕</button>
                        </div>
                        <p className="text-xs text-slate-300">
                            Lançamento: <strong className="text-white">{adjustFor.description}</strong>
                        </p>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Valor Pago (R$)</label>
                            <input
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                value={adjustValue}
                                onChange={(e) => setAdjustValue(e.target.value)}
                                className="w-full bg-[#0a0e1a] border border-white/15 focus:border-indigo-500 rounded-xl px-3 py-2 text-base font-black text-white focus:outline-none"
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setAdjustFor(null)}
                                className="flex-1 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const num = parseFloat(String(adjustValue).replace(',', '.')) || 0;
                                    if (num > 0 && num !== Number(adjustFor.amount)) {
                                        await onAdjustAmount(adjustFor.id, num);
                                    }
                                    await onTogglePaid(adjustFor.id, true);
                                    setAdjustFor(null);
                                }}
                                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white"
                            >
                                Pagar com este valor
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}