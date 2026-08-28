'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    ShoppingBag, 
    Plus, 
    ExternalLink, 
    CheckCircle2, 
    Trash2, 
    Edit3, 
    Search, 
    X, 
    Tag, 
    Sparkles, 
    AlertCircle, 
    Clock, 
    ArrowUpRight,
    Filter
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const PRIORITIES = [
    { value: 'high', label: 'Alta (Urgente)', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', badge: '🔴 Urgente' },
    { value: 'medium', label: 'Média (Próx. Mês)', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', badge: '🟡 Próximo Mês' },
    { value: 'low', label: 'Baixa (Sonho/Espera)', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: '🟢 Pode Esperar' },
];

const DEFAULT_CATEGORIES = [
    'Cozinha',
    'Quarto',
    'Sala',
    'Banheiro',
    'Lavanderia & Casa',
    'Eletrônicos & Setup',
    'Carro & Garagem',
    'Filhos & Bebê',
    'Vestuário & Pessoal',
    'Outro'
];

export default function Wishlist({
    wishlist = [],
    onAdd,
    onUpdate,
    onDelete,
    onConvertToTransaction,
    partner1 = 'Alle',
    partner2 = 'Kelly'
}) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('planned'); // planned | purchased | all
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [targetFilter, setTargetFilter] = useState('all'); // all | Alle | Kelly | Casa | Filhos
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        price: '',
        url: '',
        priority: 'medium',
        target: 'Casa',
        category: 'Cozinha',
        notes: '',
        status: 'planned'
    });

    const openAddModal = () => {
        setEditingItem(null);
        setFormData({
            title: '',
            price: '',
            url: '',
            priority: 'medium',
            target: 'Casa',
            category: 'Cozinha',
            notes: '',
            status: 'planned'
        });
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            title: item.title || '',
            price: item.price ? String(item.price) : '',
            url: item.url || '',
            priority: item.priority || 'medium',
            target: item.target || 'Casa',
            category: item.category || 'Cozinha',
            notes: item.notes || '',
            status: item.status || 'planned'
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        const payload = {
            id: editingItem ? editingItem.id : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
            title: formData.title.trim(),
            price: Math.max(0, parseFloat(String(formData.price).replace(',', '.')) || 0),
            url: formData.url.trim(),
            priority: formData.priority,
            target: formData.target,
            category: formData.category,
            notes: formData.notes.trim(),
            status: formData.status || 'planned',
            updated_at: new Date().toISOString()
        };

        if (editingItem) {
            await onUpdate(payload);
        } else {
            payload.created_at = new Date().toISOString();
            await onAdd(payload);
        }

        setIsModalOpen(false);
    };

    const filteredItems = useMemo(() => {
        return wishlist.filter(item => {
            if (!item) return false;
            
            // Status filter
            if (statusFilter !== 'all' && (item.status || 'planned') !== statusFilter) {
                return false;
            }

            // Priority filter
            if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
                return false;
            }

            // Target filter
            if (targetFilter !== 'all' && item.target !== targetFilter) {
                return false;
            }

            // Search filter
            if (search.trim()) {
                const q = search.toLowerCase();
                const titleMatch = (item.title || '').toLowerCase().includes(q);
                const categoryMatch = (item.category || '').toLowerCase().includes(q);
                const notesMatch = (item.notes || '').toLowerCase().includes(q);
                if (!titleMatch && !categoryMatch && !notesMatch) return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by priority first (high -> medium -> low), then date
            const pOrder = { high: 0, medium: 1, low: 2 };
            const orderA = pOrder[a.priority] ?? 1;
            const orderB = pOrder[b.priority] ?? 1;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }, [wishlist, statusFilter, priorityFilter, targetFilter, search]);

    // Statistics calculations
    const stats = useMemo(() => {
        const planned = wishlist.filter(i => (i.status || 'planned') === 'planned');
        const purchased = wishlist.filter(i => i.status === 'purchased');
        const highPriority = planned.filter(i => i.priority === 'high');

        const totalPlanned = planned.reduce((acc, i) => acc + (Number(i.price) || 0), 0);
        const totalHigh = highPriority.reduce((acc, i) => acc + (Number(i.price) || 0), 0);
        const totalPurchased = purchased.reduce((acc, i) => acc + (Number(i.price) || 0), 0);

        return {
            plannedCount: planned.length,
            totalPlanned,
            highCount: highPriority.length,
            totalHigh,
            purchasedCount: purchased.length,
            totalPurchased
        };
    }, [wishlist]);

    const getTargetBadge = (target) => {
        if (target === 'Alle' || target === partner1) {
            return <span className="text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/25">{partner1}</span>;
        }
        if (target === 'Kelly' || target === partner2) {
            return <span className="text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/25">{partner2}</span>;
        }
        if (target === 'Filhos') {
            return <span className="text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/25">👶 Filhos</span>;
        }
        return <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/25">🏡 Casa</span>;
    };

    const getPriorityBadge = (priority) => {
        const p = PRIORITIES.find(x => x.value === priority) || PRIORITIES[1];
        return (
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${p.bg} ${p.color} ${p.border}`}>
                {p.badge}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header com Ação */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="h-6 w-6 text-indigo-400" />
                        Desejos & Compras Planejadas
                    </h2>
                    <p className="text-sm text-slate-400">
                        Organize produtos que vocês querem comprar, compare preços e links das lojas.
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-indigo-500/20 border border-indigo-400/30 hover:scale-105 active:scale-95"
                >
                    <Plus className="h-4 w-4" />
                    Novo Desejo
                </button>
            </div>

            {/* Resumo / Totalizadores */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <Card className="bg-[#1e293b]/70 border-slate-800 shadow-lg">
                    <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">🛒 Planejadas ({stats.plannedCount})</p>
                        <p className="text-xl md:text-2xl font-bold text-white">{formatCurrency(stats.totalPlanned)}</p>
                        <p className="text-[10px] text-slate-400">Total a investir no futuro</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1e293b]/70 border-red-500/20 shadow-lg">
                    <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-red-400">🔴 Alta Prioridade ({stats.highCount})</p>
                        <p className="text-xl md:text-2xl font-bold text-red-300">{formatCurrency(stats.totalHigh)}</p>
                        <p className="text-[10px] text-red-400/70">Itens mais urgentes</p>
                    </CardContent>
                </Card>

                <Card className="col-span-2 md:col-span-1 bg-[#1e293b]/70 border-emerald-500/20 shadow-lg">
                    <CardContent className="p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">✅ Já Compradas ({stats.purchasedCount})</p>
                        <p className="text-xl md:text-2xl font-bold text-emerald-300">{formatCurrency(stats.totalPurchased)}</p>
                        <p className="text-[10px] text-emerald-400/70">Objetivos conquistados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros e Busca */}
            <Card className="bg-[#1e293b]/60 border-slate-800">
                <CardContent className="p-4 space-y-3">
                    {/* Busca */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Buscar produto, loja, categoria ou anotação..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 bg-slate-900/80 border-slate-700 text-sm"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Status Toggle */}
                    <div className="flex gap-2 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
                        {[
                            { value: 'planned', label: `🎯 Planejados (${stats.plannedCount})` },
                            { value: 'purchased', label: `✅ Comprados (${stats.purchasedCount})` },
                            { value: 'all', label: `Todos (${wishlist.length})` }
                        ].map((s) => (
                            <button
                                key={s.value}
                                onClick={() => setStatusFilter(s.value)}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    statusFilter === s.value
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Pílulas de Filtro (Prioridade e Responsável) */}
                    <div className="flex flex-col sm:flex-row gap-2 justify-between pt-1">
                        {/* Prioridade */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            <span className="text-[11px] font-bold text-slate-500 self-center mr-1">Prioridade:</span>
                            {[
                                { value: 'all', label: 'Todas' },
                                { value: 'high', label: '🔴 Alta' },
                                { value: 'medium', label: '🟡 Média' },
                                { value: 'low', label: '🟢 Baixa' },
                            ].map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => setPriorityFilter(p.value)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                                        priorityFilter === p.value
                                            ? 'bg-slate-700 text-white border border-slate-600'
                                            : 'bg-slate-900/40 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Responsável / Destino */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            <span className="text-[11px] font-bold text-slate-500 self-center mr-1">Para:</span>
                            {[
                                { value: 'all', label: 'Todos' },
                                { value: 'Casa', label: '🏡 Casa' },
                                { value: partner1, label: partner1 },
                                { value: partner2, label: partner2 },
                                { value: 'Filhos', label: '👶 Filhos' },
                            ].map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTargetFilter(t.value)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                                        targetFilter === t.value
                                            ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                                            : 'bg-slate-900/40 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Grid de Itens */}
            {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-800/30 rounded-3xl border border-slate-800 text-center space-y-3">
                    <ShoppingBag className="h-10 w-10 text-slate-600" />
                    <p className="text-slate-300 font-medium">Nenhum item encontrado com esses filtros.</p>
                    <button
                        onClick={openAddModal}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Adicionar Novo Item
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((item) => {
                        const isPurchased = item.status === 'purchased';
                        return (
                            <Card 
                                key={item.id} 
                                className={`bg-[#1e293b] border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between overflow-hidden group shadow-lg ${
                                    isPurchased ? 'opacity-70 bg-[#1e293b]/60' : ''
                                }`}
                            >
                                <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                                    <div className="space-y-3">
                                        {/* Top badges */}
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                {getTargetBadge(item.target)}
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                                                    {item.category || 'Geral'}
                                                </span>
                                            </div>
                                            {getPriorityBadge(item.priority)}
                                        </div>

                                        {/* Item Title & Price */}
                                        <div>
                                            <h3 className={`font-bold text-base text-white line-clamp-2 ${isPurchased ? 'line-through text-slate-400' : ''}`}>
                                                {item.title}
                                            </h3>
                                            <p className="text-xl font-extrabold text-emerald-400 mt-1">
                                                {item.price > 0 ? formatCurrency(item.price) : <span className="text-xs text-slate-500 font-normal">Preço a definir</span>}
                                            </p>
                                        </div>

                                        {/* Notes */}
                                        {item.notes && (
                                            <p className="text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80">
                                                {item.notes}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-2 pt-2 border-t border-slate-800">
                                        <div className="flex items-center gap-2">
                                            {item.url ? (
                                                <a
                                                    href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                                                    Abrir Loja
                                                </a>
                                            ) : (
                                                <span className="flex-1 py-2 text-center text-[11px] text-slate-600">Sem link direto</span>
                                            )}

                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 cursor-pointer"
                                                title="Editar item"
                                            >
                                                <Edit3 className="h-4 w-4" />
                                            </button>

                                            <button
                                                onClick={() => onDelete(item.id)}
                                                className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 cursor-pointer"
                                                title="Excluir item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {/* Botão de "Comprei!" ou "Reabrir" */}
                                        {!isPurchased ? (
                                            <button
                                                onClick={() => {
                                                    if (onConvertToTransaction) {
                                                        onConvertToTransaction(item);
                                                    } else {
                                                        onUpdate({ ...item, status: 'purchased' });
                                                    }
                                                }}
                                                className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-extrabold rounded-xl transition-all border border-emerald-500/30 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                COMPREI! (Lançar no Caixa)
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onUpdate({ ...item, status: 'planned' })}
                                                className="w-full py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] font-bold rounded-xl transition-all border border-slate-700/80 flex items-center justify-center gap-1 cursor-pointer"
                                            >
                                                Mover para Planejados
                                            </button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal de Adicionar / Editar Desejo */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5 text-indigo-400" />
                                {editingItem ? 'Editar Desejo' : 'Novo Item Desejado'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Nome do Item */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">O que vocês querem comprar?</label>
                                <Input
                                    placeholder="Ex: Fritadeira Air Fryer 4L, Cadeira de Escritório..."
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            {/* Preço e Prioridade */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preço Estimado (R$)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0,00"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="bg-slate-900 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridade</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer h-[42px]"
                                    >
                                        <option value="high">🔴 Alta (Urgente)</option>
                                        <option value="medium">🟡 Média (Próx. Mês)</option>
                                        <option value="low">🟢 Baixa (Pode Esperar)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Link do Produto */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Link da Loja (Opcional)</label>
                                    {formData.url && (
                                        <a
                                            href={formData.url.startsWith('http') ? formData.url : `https://${formData.url}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                                        >
                                            Testar link <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                    )}
                                </div>
                                <Input
                                    placeholder="Ex: https://www.mercadolivre.com.br/..."
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    className="bg-slate-900 border-slate-700 text-white text-xs"
                                />
                            </div>

                            {/* Para Quem e Categoria */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Para Quem?</label>
                                    <select
                                        value={formData.target}
                                        onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer h-[42px]"
                                    >
                                        <option value="Casa">🏡 Casa</option>
                                        <option value={partner1}>{partner1} (Pessoal)</option>
                                        <option value={partner2}>{partner2} (Pessoal)</option>
                                        <option value="Filhos">👶 Filhos</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cômodo / Categoria</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer h-[42px]"
                                    >
                                        {DEFAULT_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Anotações */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Observações / Medidas</label>
                                <Input
                                    placeholder="Ex: Voltagem 110v, cor preta, cupom de 10%..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            {/* Botões do Modal */}
                            <div className="pt-3 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                                >
                                    {editingItem ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR DESEJO'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
