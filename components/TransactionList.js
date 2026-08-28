'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    ArrowUpRight, 
    ArrowDownLeft, 
    CreditCard, 
    Trash2, 
    ChevronDown, 
    CheckCircle2, 
    Clock, 
    Pencil, 
    X, 
    Check, 
    Edit3, 
    Search,
    SlidersHorizontal,
    MoreVertical,
    Calendar
} from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { formatCurrency, formatDate } from '@/lib/format';

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
    onSelectFatura,
    onPayInvoice,
    variaveis = [],
    isPrivate = false
}) {
    const [filter, setFilter] = useState('all'); // all | income | expense | credit
    const [spenderFilter, setSpenderFilter] = useState('all'); // all | Eu | Outro | Comum | Filhos
    const [searchTerm, setSearchTerm] = useState('');
    const [showAllPending, setShowAllPending] = useState(false);
    const [showAllPaid, setShowAllPaid] = useState(false);
    const [showAllPendingIncome, setShowAllPendingIncome] = useState(false);
    const [showAllPaidIncome, setShowAllPaidIncome] = useState(false);
    const [adjustFor, setAdjustFor] = useState(null);
    const [adjustValue, setAdjustValue] = useState('');
    const [activeActionMenu, setActiveActionMenu] = useState(null);

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
                const d = new Date(t.date);
                return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
            });
        }

        if (selectedFaturaFilter) {
            list = list.filter(t => {
                if (!t || !t.date) return false;
                const d = new Date(t.date);
                const matchesFaturaMonth = d.getMonth() === selectedFaturaFilter.month;
                const matchesFaturaYear = d.getFullYear() === selectedFaturaFilter.year;
                const matchesFaturaCard = t.card_name === selectedFaturaFilter.cardNome;
                return matchesFaturaMonth && matchesFaturaYear && matchesFaturaCard;
            });
        }

        return list;
    }, [transactions, filter, spenderFilter, searchTerm, selectedCardFilter, viewDate, selectedFaturaFilter]);

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

        const cardRows = Object.entries(cards).map(([cardName, items]) => {
            const cardInfo = (cardsSummary || []).find(c => c && c.nome === cardName);
            const sumItems = items.reduce((a, t) => a + Number(t.amount || 0), 0);
            const amount = cardInfo && cardInfo.isAjustada ? Number(cardInfo.faturaAtual || 0) : sumItems;
            const allPaid = cardInfo ? !!cardInfo.isPaga : items.every(t => t.pago);
            const isAjustada = !!(cardInfo && cardInfo.isAjustada);

            return {
                __cardRow: true,
                id: 'card|' + cardName,
                card_name: cardName,
                items,
                amount,
                allPaid,
                isAjustada,
            };
        });

        // Adiciona cartões cadastrados sem compras no mês mas com fatura ajustada
        if ((filter === 'all' || filter === 'credit') && !selectedCardFilter && spenderFilter === 'all' && !searchTerm) {
            (cardsSummary || []).forEach(c => {
                if (c && c.faturaAtual > 0 && !cards[c.nome]) {
                    const matchPaid = isPaidContext ? c.isPaga : !c.isPaga;
                    if (matchPaid) {
                        cardRows.push({
                            __cardRow: true,
                            id: 'card|' + c.nome,
                            card_name: c.nome,
                            items: [],
                            amount: Number(c.faturaAtual || 0),
                            allPaid: !!c.isPaga,
                            isAjustada: !!c.isAjustada,
                        });
                    }
                }
            });
        }

        return [...rest, ...cardRows];
    }, [cardsSummary, filter, selectedCardFilter, spenderFilter, searchTerm]);

    const sum = (list) => (list || []).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const pendingExpenses = useMemo(() => pendingList.filter(t => t.type !== 'income'), [pendingList]);
    const paidExpenses = useMemo(() => paidList.filter(t => t.type !== 'income'), [paidList]);

    const pendingIncome = useMemo(() => pendingList.filter(t => t.type === 'income'), [pendingList]);
    const paidIncome = useMemo(() => paidList.filter(t => t.type === 'income'), [paidList]);

    const pendingExpenseDisplay = useMemo(() => consolidateCards(pendingExpenses, false), [pendingExpenses, consolidateCards]);
    const paidExpenseDisplay = useMemo(() => consolidateCards(paidExpenses, true), [paidExpenses, consolidateCards]);

    const pendingIncomeDisplay = useMemo(() => pendingIncome, [pendingIncome]);
    const paidIncomeDisplay = useMemo(() => paidIncome, [paidIncome]);

    const isIncomeFilter = filter === 'income';
    const isExpenseOrCredit = filter === 'expense' || filter === 'credit';

    const pendingExpenseTotal = useMemo(() => sum(pendingExpenseDisplay), [pendingExpenseDisplay]);
    const paidExpenseTotal = useMemo(() => sum(paidExpenseDisplay), [paidExpenseDisplay]);
    const pendingIncomeTotal = useMemo(() => sum(pendingIncomeDisplay), [pendingIncomeDisplay]);
    const paidIncomeTotal = useMemo(() => sum(paidIncomeDisplay), [paidIncomeDisplay]);

    const grandTotal = isIncomeFilter 
        ? (pendingIncomeTotal + paidIncomeTotal)
        : (pendingExpenseTotal + paidExpenseTotal);
    const paidTotal = isIncomeFilter ? paidIncomeTotal : paidExpenseTotal;
    const paidRatio = grandTotal > 0 ? Math.round((paidTotal / grandTotal) * 100) : 0;

    const showPending = statusFilter === 'all' || statusFilter === 'pending';
    const showPaid = statusFilter === 'all' || statusFilter === 'paid';

    const displayAmount = (val) => {
        if (isPrivate) return '••••••';
        return formatCurrency(val);
    };

    const typeConfig = {
        income: { icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/10', sign: '+' },
        expense: { icon: ArrowDownLeft, color: 'text-rose-400', bg: 'bg-rose-500/10', sign: '-' },
        credit: { icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10', sign: '-' },
    };

    const filterButtons = [
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
        const due = new Date(t.date);
        due.setHours(0, 0, 0, 0);
        return due < today;
    };

    const getSpenderBadge = (quem) => {
        if (quem === 'Eu') {
            return <span className="text-[9px] font-black uppercase bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">{partner1}</span>;
        }
        if (quem === 'Outro') {
            return <span className="text-[9px] font-black uppercase bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">{partner2}</span>;
        }
        if (quem === 'Comum - Eu') {
            return <span className="text-[9px] font-black uppercase bg-teal-500/15 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/30">Comum ({partner1})</span>;
        }
        if (quem === 'Comum - Outro') {
            return <span className="text-[9px] font-black uppercase bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">Comum ({partner2})</span>;
        }
        if (quem === 'Filhos' || quem === 'Comum - Filhos') {
            return <span className="text-[9px] font-black uppercase bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">👶 Filhos</span>;
        }
        if (quem === 'Comum') {
            return <span className="text-[9px] font-black uppercase bg-slate-500/15 text-slate-300 px-2 py-0.5 rounded-full border border-slate-500/30">Comum</span>;
        }
        return null;
    };

    const renderItem = (t) => {
        if (t.__cardRow) {
            return (
                <div key={t.id} className="group flex items-center justify-between rounded-2xl p-3 sm:p-3.5 border border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/15 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => onPayInvoice && onPayInvoice(t.card_name, !t.allPaid)}
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer active:scale-90 ${
                                t.allPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}
                            title={t.allPaid ? 'Reabrir fatura' : 'Pagar fatura inteira'}
                        >
                            {t.allPaid ? (
                                <CheckCircle2 className="h-5 w-5" />
                            ) : (
                                <Clock className="h-5 w-5" />
                            )}
                        </button>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-purple-200 truncate flex items-center gap-1.5 flex-wrap">
                                <CreditCard className="h-4 w-4 text-purple-400" /> Fatura {t.card_name}
                                {t.isAjustada && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        AJUSTADA
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-slate-400">
                                {t.items.length > 0 
                                    ? `${t.items.length} ${t.items.length === 1 ? 'compra' : 'compras'} no mês` 
                                    : 'Fatura ajustada no cartão'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-sm sm:text-base font-black ${t.allPaid ? 'text-slate-500 line-through' : 'text-purple-300'}`}>
                            -{displayAmount(t.amount)}
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
                className={`group flex items-center justify-between rounded-2xl p-3 sm:p-3.5 border transition-all duration-200 ${
                    isPaid 
                        ? 'bg-[#121827]/40 border-white/5 opacity-75' 
                        : 'bg-[#121827]/80 hover:bg-[#121827] border-white/10 shadow-sm'
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
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer active:scale-90 ${
                            isPaid 
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                                : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                        }`}
                        title={isPaid ? "Marcar como pendente" : ((t.installment_info || isVariavel(t)) ? "Pagar (digite o valor real)" : "Marcar como PAGO ✓")}
                    >
                        {isPaid ? (
                            <CheckCircle2 className="h-5 w-5" />
                        ) : (
                            <Clock className="h-5 w-5" />
                        )}
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`text-sm font-bold text-slate-100 truncate ${isPaid ? 'line-through text-slate-400 decoration-slate-500/60' : ''}`}>
                                {t.description}
                            </p>
                            {getSpenderBadge(t.quem)}
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                                <CategoryIcon category={t.category} size="sm" />
                                {t.category}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span>{formatDate(t.date)}</span>
                            {t.installment_info && (
                                <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded-md border border-indigo-500/30">
                                    {t.installment_info}
                                </span>
                            )}
                            {t.fixa && (
                                <span className="text-[9px] font-black text-blue-300 bg-blue-500/15 px-1.5 py-0.5 rounded-md border border-blue-500/30">
                                    FIXA
                                </span>
                            )}
                            {overdue && (
                                <span className="text-[9px] font-black text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded-md border border-rose-500/30">
                                    VENCIDA
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                    <span className={`text-sm sm:text-base font-black ${isPaid ? 'text-slate-400' : config.color}`}>
                        {config.sign}{displayAmount(t.amount)}
                    </span>

                    {/* Action buttons (Touch-Friendly, Always Visible on Mobile) */}
                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(t)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer active:scale-90"
                                title="Editar Lançamento"
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(t)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer active:scale-90"
                                title="Excluir Lançamento"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
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
            <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${accentText} flex items-center gap-1.5`}>
                        <span>{emoji}</span> {title}
                    </span>
                    <span className="text-xs text-slate-400">
                        {count} {count === 1 ? 'item' : 'itens'} • <span className={`font-black ${accentValue}`}>{displayAmount(total)}</span>
                    </span>
                </div>
                <div className="space-y-2">
                    {items.map(renderItem)}
                </div>
                {count > 15 && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer active:scale-98"
                    >
                        Ver todas ({count}) <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <Card className="border-white/10 bg-[#0f172a]/90 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-3.5 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        📄 Extrato & Lançamentos
                    </CardTitle>
                    {selectedCardFilter && (
                        <button
                            onClick={onClearCardFilter}
                            className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1 bg-purple-500/20 px-3 py-1 rounded-xl border border-purple-500/30 cursor-pointer"
                        >
                            Filtro: {selectedCardFilter} <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por descrição, categoria ou cartão..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Summary Metrics Banner */}
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {isIncomeFilter ? (
                            <>
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">⏳ A Receber</p>
                                    <p className="text-base sm:text-lg font-black text-emerald-300">{displayAmount(pendingIncomeTotal)}</p>
                                    <p className="text-[10px] text-emerald-400/70">{pendingIncomeDisplay.length} itens</p>
                                </div>
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">✅ Recebidas</p>
                                    <p className="text-base sm:text-lg font-black text-emerald-300">{displayAmount(paidIncomeTotal)}</p>
                                    <p className="text-[10px] text-emerald-400/70">{paidIncomeDisplay.length} itens</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">⏳ A Pagar</p>
                                    <p className="text-base sm:text-lg font-black text-amber-300">{displayAmount(pendingExpenseTotal)}</p>
                                    <p className="text-[10px] text-amber-400/70">{pendingExpenseDisplay.length} itens</p>
                                </div>
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">✅ Pagas</p>
                                    <p className="text-base sm:text-lg font-black text-emerald-300">{displayAmount(paidExpenseTotal)}</p>
                                    <p className="text-[10px] text-emerald-400/70">{paidExpenseDisplay.length} itens</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${paidRatio}%` }}
                        />
                    </div>
                </div>

                {/* Filter Chips 1: Type */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {filterButtons.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => { setFilter(f.value); setShowAllPending(false); setShowAllPaid(false); }}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                filter === f.value
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 border border-indigo-400/30'
                                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Filter Chips 2: Status */}
                <div className="flex gap-1.5 p-1 rounded-2xl bg-[#0a0e1a] border border-white/10">
                    {[
                        { value: 'all', label: `Todas (${filteredTransactions.length})` },
                        { value: 'pending', label: `⏳ Pendentes` },
                        { value: 'paid', label: `✅ Concluídas` }
                    ].map((s) => (
                        <button
                            key={s.value}
                            onClick={() => { onStatusFilterChange && onStatusFilterChange(s.value); setShowAllPending(false); setShowAllPaid(false); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 ${
                                statusFilter === s.value 
                                ? 'bg-slate-800 text-white shadow-md border border-white/10' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Filter Chips 3: Spender / Quem */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {[
                        { value: 'all', label: '👥 Todos' },
                        { value: 'Eu', label: `${partner1}` },
                        { value: 'Outro', label: `${partner2}` },
                        { value: 'Comum', label: '🏡 Comum' },
                        { value: 'Filhos', label: '👶 Filhos' }
                    ].map((sf) => (
                        <button
                            key={sf.value}
                            onClick={() => { setSpenderFilter(sf.value); setShowAllPending(false); setShowAllPaid(false); }}
                            className={`flex-1 py-1.5 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                spenderFilter === sf.value
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                            }`}
                        >
                            {sf.label}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent>
                {/* Modal / Alert for adjusting variable amount */}
                {adjustFor && (
                    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-3 animate-fade-in">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{adjustFor.description}</p>
                                <p className="text-[11px] text-amber-300/80">
                                    {adjustFor.installment_info
                                        ? `Parcela (${adjustFor.installment_info}) • ajuste o valor real pago`
                                        : 'Conta variável • digite o valor real pago'}
                                </p>
                            </div>
                            <button
                                onClick={() => setAdjustFor(null)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-amber-300">Valor real (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    autoFocus
                                    value={adjustValue}
                                    onChange={(e) => setAdjustValue(e.target.value)}
                                    className="w-full bg-[#0a0e1a] border border-amber-500/40 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-black hover:bg-amber-400 transition-all cursor-pointer active:scale-95"
                            >
                                <Check className="h-4 w-4" /> Pagar
                            </button>
                        </div>
                    </div>
                )}

                {/* List Container */}
                <div className="space-y-5 max-h-[560px] overflow-y-auto pr-1">
                    {showPending && (
                        filter === 'all' ? (
                            <>
                                {pendingIncomeDisplay.length > 0 && renderSection(
                                    'A Receber', 
                                    '💰', 
                                    showAllPendingIncome ? pendingIncomeDisplay : pendingIncomeDisplay.slice(0, 15), 
                                    pendingIncomeTotal, 
                                    pendingIncomeDisplay.length, 
                                    showAllPendingIncome, 
                                    setShowAllPendingIncome, 
                                    'text-emerald-400', 
                                    'text-emerald-300'
                                )}
                                {pendingExpenseDisplay.length > 0 && renderSection(
                                    'A Pagar', 
                                    '⏳', 
                                    showAllPending ? pendingExpenseDisplay : pendingExpenseDisplay.slice(0, 15), 
                                    pendingExpenseTotal, 
                                    pendingExpenseDisplay.length, 
                                    showAllPending, 
                                    setShowAllPending, 
                                    'text-amber-400', 
                                    'text-amber-300'
                                )}
                            </>
                        ) : isIncomeFilter ? (
                            renderSection(
                                'A Receber', 
                                '💰', 
                                showAllPendingIncome ? pendingIncomeDisplay : pendingIncomeDisplay.slice(0, 15), 
                                pendingIncomeTotal, 
                                pendingIncomeDisplay.length, 
                                showAllPendingIncome, 
                                setShowAllPendingIncome, 
                                'text-emerald-400', 
                                'text-emerald-300'
                            )
                        ) : (
                            renderSection(
                                'A Pagar', 
                                '⏳', 
                                showAllPending ? pendingExpenseDisplay : pendingExpenseDisplay.slice(0, 15), 
                                pendingExpenseTotal, 
                                pendingExpenseDisplay.length, 
                                showAllPending, 
                                setShowAllPending, 
                                'text-amber-400', 
                                'text-amber-300'
                            )
                        )
                    )}

                    {showPaid && (
                        filter === 'all' ? (
                            <>
                                {paidIncomeDisplay.length > 0 && renderSection(
                                    'Recebidas', 
                                    '✅', 
                                    showAllPaidIncome ? paidIncomeDisplay : paidIncomeDisplay.slice(0, 15), 
                                    paidIncomeTotal, 
                                    paidIncomeDisplay.length, 
                                    showAllPaidIncome, 
                                    setShowAllPaidIncome, 
                                    'text-emerald-400', 
                                    'text-emerald-300'
                                )}
                                {paidExpenseDisplay.length > 0 && renderSection(
                                    'Pagas', 
                                    '✅', 
                                    showAllPaid ? paidExpenseDisplay : paidExpenseDisplay.slice(0, 15), 
                                    paidExpenseTotal, 
                                    paidExpenseDisplay.length, 
                                    showAllPaid, 
                                    setShowAllPaid, 
                                    'text-slate-400', 
                                    'text-slate-300'
                                )}
                            </>
                        ) : isIncomeFilter ? (
                            renderSection(
                                'Recebidas', 
                                '✅', 
                                showAllPaidIncome ? paidIncomeDisplay : paidIncomeDisplay.slice(0, 15), 
                                paidIncomeTotal, 
                                paidIncomeDisplay.length, 
                                showAllPaidIncome, 
                                setShowAllPaidIncome, 
                                'text-emerald-400', 
                                'text-emerald-300'
                            )
                        ) : (
                            renderSection(
                                'Pagas', 
                                '✅', 
                                showAllPaid ? paidExpenseDisplay : paidExpenseDisplay.slice(0, 15), 
                                paidExpenseTotal, 
                                paidExpenseDisplay.length, 
                                showAllPaid, 
                                setShowAllPaid, 
                                'text-slate-400', 
                                'text-slate-300'
                            )
                        )
                    )}

                    {pendingExpenseDisplay.length === 0 && pendingIncomeDisplay.length === 0 && paidExpenseDisplay.length === 0 && paidIncomeDisplay.length === 0 && (
                        <div className="text-center py-12 space-y-2">
                            <p className="text-3xl">🔍</p>
                            <p className="text-sm font-medium text-slate-400">Nenhuma transação encontrada.</p>
                            <p className="text-xs text-slate-500">Tente ajustar os filtros ou cadastrar um novo lançamento.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}