'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, CreditCard, Trash2, ChevronDown, CheckCircle2, Clock, Lock } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';

export default function TransactionList({ transactions, onDelete, onTogglePaid, statusFilter = 'all', onStatusFilterChange }) {
    const [filter, setFilter] = useState('all'); // all | income | expense | credit
    const [showAll, setShowAll] = useState(false);

    const filteredTransactions = useMemo(() => {
        let list = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (filter !== 'all') {
            list = list.filter(t => t.type === filter);
        }
        if (statusFilter === 'pending') {
            list = list.filter(t => !t.pago);
        } else if (statusFilter === 'paid') {
            list = list.filter(t => t.pago);
        }
        return list;
    }, [transactions, filter, statusFilter]);

    const displayedTransactions = showAll ? filteredTransactions : filteredTransactions.slice(0, 15);

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

    return (
        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Transações</CardTitle>
                    <span className="text-xs text-muted-foreground">{filteredTransactions.length} itens</span>
                </div>
                {/* Filters */}
                <div className="flex flex-col gap-3 pt-2">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {filterButtons.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => { setFilter(f.value); setShowAll(false); }}
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
                            { value: 'all', label: '📄 Todas' },
                            { value: 'paid', label: '✅ Pagas' },
                            { value: 'pending', label: '⏳ A Pagar' }
                        ].map((s) => (
                            <button
                                key={s.value}
                                onClick={() => onStatusFilterChange && onStatusFilterChange(s.value)}
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
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {displayedTransactions.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Nenhuma transação encontrada.</p>
                    ) : (
                        displayedTransactions.map((t, i) => {
                            const config = typeConfig[t.type] || typeConfig.expense;
                            const Icon = config.icon;
                            const isPaid = t.pago;
                            
                            return (
                                <div
                                    key={t.id}
                                    className={`group flex items-center justify-between rounded-lg p-3 transition-all duration-200 ${
                                        isPaid ? 'bg-secondary/10 opacity-80' : 'hover:bg-secondary/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button 
                                            onClick={() => onTogglePaid && onTogglePaid(t.id, !isPaid)}
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ${
                                                isPaid ? 'bg-emerald-500/20' : 'bg-amber-500/10 hover:bg-amber-500/20'
                                            }`}
                                            title={isPaid ? "Marcar como pendente" : "Marcar como pago"}
                                        >
                                            {isPaid ? (
                                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                            ) : (
                                                <Clock className="h-5 w-5 text-amber-500/70" />
                                            )}
                                        </button>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium leading-tight truncate ${isPaid ? 'text-slate-400 line-through decoration-slate-500/50' : ''}`}>
                                                {t.description}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-xs text-muted-foreground">{t.category}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                                                {t.fixa && (
                                                    <>
                                                        <span className="text-muted-foreground/40">•</span>
                                                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1 rounded">
                                                            <Lock className="h-2.5 w-2.5" /> FIXA
                                                        </span>
                                                    </>
                                                )}
                                                {t.subcategoria && (
                                                    <>
                                                        <span className="text-muted-foreground/40">•</span>
                                                        <span className="text-xs text-indigo-300/70 italic">{t.subcategoria}</span>
                                                    </>
                                                )}
                                                {t.destino && (
                                                    <>
                                                        <span className="text-muted-foreground/40">•</span>
                                                        <span className="text-xs text-slate-500">📍 {t.destino}</span>
                                                    </>
                                                )}
                                                {t.card_name && (
                                                    <>
                                                        <span className="text-muted-foreground/40">•</span>
                                                        <span className="text-xs text-purple-400/70">{t.card_name}</span>
                                                    </>
                                                )}
                                                {t.installment_info && (
                                                    <span className="text-xs text-purple-300/50 ml-0.5">({t.installment_info})</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className={`text-sm font-semibold ${isPaid ? 'text-slate-400' : config.color}`}>
                                            {config.sign}{formatCurrency(t.amount)}
                                        </span>
                                        {onDelete && (
                                            <button
                                                onClick={() => onDelete(t.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 cursor-pointer"
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Show More */}
                {filteredTransactions.length > 15 && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all cursor-pointer"
                    >
                        <ChevronDown className="h-3.5 w-3.5" />
                        Ver mais ({filteredTransactions.length - 15} restantes)
                    </button>
                )}
            </CardContent>
        </Card>
    );
}
