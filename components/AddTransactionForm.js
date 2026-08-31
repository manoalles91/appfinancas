'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, CreditCard, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Check, Calendar, Tag, User, Layers } from 'lucide-react';
import { getCategories } from '@/lib/categories';
import { useToast } from '@/components/ui/toast';

const TRANSACTION_TYPES = [
    { value: 'expense', label: 'Despesa', icon: ArrowDownLeft, activeBg: 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border-rose-500' },
    { value: 'income', label: 'Receita', icon: ArrowUpRight, activeBg: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border-emerald-500' },
    { value: 'credit', label: 'Cartão', icon: CreditCard, activeBg: 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border-purple-500' },
];

const initialForm = () => ({
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    date: new Date().toISOString().split('T')[0],
    installments: 1,
    cardName: '',
    pago: false,
    formato: 'unica',
    parcelasN: 2,
    valorTipo: 'total',
    payment_method: 'checking',
    quem: 'Comum',
    subcategoria: '',
    destino: '',
});

export default function AddTransactionForm({ 
    onAdd, 
    onAddMany, 
    cartoes = [], 
    partner1 = 'Alle', 
    partner2 = 'Kelly',
    initialType = null,
    onSuccess
}) {
    const [quemPagou, setQuemPagou] = useState('Dividido');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [formData, setFormData] = useState(() => {
        const init = initialForm();
        if (initialType) init.type = initialType;
        if (initialType === 'credit') init.payment_method = 'credit';
        return init;
    });
    const [groupOptions] = useState(() => getCategories());
    const { toast } = useToast();

    const categoryOptions = selectedGroup
        ? (groupOptions.find((g) => g.id === selectedGroup)?.categories || [])
        : [];
    const selectedCatInfo = categoryOptions.find((c) => c.name === selectedCategory);

    const selectGroup = (groupId) => {
        setSelectedGroup(groupId);
        setSelectedCategory('');
        setFormData(prev => ({ ...prev, category: '', subcategoria: '' }));
    };

    const selectCategory = (catName) => {
        setSelectedCategory(catName);
        setFormData(prev => ({ ...prev, category: catName, subcategoria: '' }));
    };

    const selectItem = (item) => {
        setFormData(prev => ({ ...prev, subcategoria: item }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const baseAmount = parseFloat(String(formData.amount).replace(',', '.')) || 0;
        if (baseAmount <= 0) {
            toast('Por favor, insira um valor válido maior que zero.', 'error');
            return;
        }
        if (formData.type === 'credit' && !formData.cardName && cartoes.length > 0) {
            toast('Selecione o cartão de crédito da compra.', 'error');
            return;
        }

        let finalQuem = formData.quem;
        if (formData.quem === 'Comum') {
            if (quemPagou === 'Eu') finalQuem = 'Comum - Eu';
            else if (quemPagou === 'Outro') finalQuem = 'Comum - Outro';
            else finalQuem = 'Comum';
        }

        try {
            const formato = formData.formato === 'fixa'
                ? 'fixa'
                : formData.formato === 'parcelada' ? 'parcelada' : 'unica';
            const parcTotal = parseInt(formData.parcelasN, 10) || 0;
            const creditParc = formData.type === 'credit' && (parseInt(formData.installments, 10) || 1) > 1;
            const totalParc = formato === 'parcelada' && parcTotal > 1
                ? parcTotal
                : (creditParc ? parseInt(formData.installments, 10) : 0);

            if (totalParc > 1) {
                const valorParcela = formData.valorTipo === 'parcela';
                const installmentAmount = valorParcela
                    ? baseAmount
                    : Math.round((baseAmount / totalParc) * 100) / 100;
                const lastAmount = valorParcela
                    ? baseAmount
                    : Math.round((baseAmount - installmentAmount * (totalParc - 1)) * 100) / 100;
                const baseDate = new Date(formData.date + 'T12:00:00');

                for (let i = 0; i < totalParc; i++) {
                    const year = baseDate.getFullYear();
                    const month = baseDate.getMonth() + i;
                    const lastDay = new Date(year, month + 1, 0).getDate();
                    const installDate = new Date(year, month, Math.min(baseDate.getDate(), lastDay), 12, 0, 0);

                    await onAdd({
                        description: formData.description,
                        amount: i === totalParc - 1 ? lastAmount : installmentAmount,
                        type: formData.type,
                        category: formData.category || (formData.type === 'income' ? 'Salário' : formData.type === 'credit' ? 'Cartão' : 'Compras'),
                        date: installDate.toISOString(),
                        cardName: formData.type === 'credit' ? formData.cardName : undefined,
                        installmentInfo: `${i + 1}/${totalParc}`,
                        pago: i === 0 ? formData.pago : false,
                        payment_method: formData.type === 'credit' ? 'credit' : formData.payment_method,
                        quem: finalQuem,
                        subcategoria: formData.subcategoria,
                        destino: formData.destino,
                    });
                }
                toast(`${formData.type === 'income' ? 'Receita' : 'Despesa'} parcelada em ${totalParc}x salva!`);
            } else if (formato === 'fixa') {
                const baseDate = new Date(formData.date + 'T12:00:00');
                const payloads = [];
                for (let i = 0; i < 24; i++) {
                    const year = baseDate.getFullYear();
                    const month = baseDate.getMonth() + i;
                    const lastDay = new Date(year, month + 1, 0).getDate();
                    const recDate = new Date(year, month, Math.min(baseDate.getDate(), lastDay), 12, 0, 0);
                    payloads.push({
                        description: formData.description,
                        amount: baseAmount,
                        type: formData.type,
                        category: formData.category || (formData.type === 'income' ? 'Salário' : 'Fixa'),
                        date: recDate.toISOString(),
                        fixa: true,
                        pago: i === 0 ? formData.pago : false,
                        payment_method: formData.type === 'credit' ? 'credit' : formData.payment_method,
                        quem: finalQuem,
                        subcategoria: formData.subcategoria,
                        destino: formData.destino,
                    });
                }
                await onAddMany(payloads, `${formData.type === 'income' ? 'Entrada' : 'Despesa'} fixa criada para os próximos 24 meses!`);
            } else {
                await onAdd({
                    description: formData.description,
                    amount: baseAmount,
                    type: formData.type,
                    category: formData.category || (formData.type === 'income' ? 'Salário' : 'Compras'),
                    date: new Date(formData.date + 'T12:00:00').toISOString(),
                    cardName: formData.type === 'credit' ? formData.cardName : undefined,
                    pago: formData.pago,
                    fixa: false,
                    payment_method: formData.type === 'credit' ? 'credit' : (formData.type === 'income' ? 'checking' : formData.payment_method),
                    quem: finalQuem,
                    subcategoria: formData.subcategoria,
                    destino: formData.destino,
                });
                toast('Lançamento registrado com sucesso!');
            }

            setQuemPagou('Dividido');
            setFormData(initialForm());
            setShowAdvanced(false);
            setSelectedGroup('');
            setSelectedCategory('');
            onSuccess && onSuccess();
        } catch (error) {
            toast('Erro ao registrar: ' + error.message, 'error');
        }
    };

    const setType = (type) => {
        setFormData(prev => ({ 
            ...prev, 
            type,
            payment_method: type === 'credit' ? 'credit' : prev.payment_method === 'credit' ? 'checking' : prev.payment_method,
            cardName: type === 'credit' && !prev.cardName && cartoes.length > 0 ? cartoes[0].nome : prev.cardName
        }));
        if (type === 'credit') setShowAdvanced(true);
    };

    return (
        <Card className="border-white/10 bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/10 space-y-1">
                <CardTitle className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-indigo-400" />
                    Novo Lançamento
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                    Cadastre uma despesa, receita ou compra no cartão rapidamente.
                </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* TYPE SELECTOR TABS */}
                    <div className="grid grid-cols-3 gap-2 p-1 bg-[#0a0e1a] rounded-2xl border border-white/10">
                        {TRANSACTION_TYPES.map((t) => {
                            const Icon = t.icon;
                            const isActive = formData.type === t.value;
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setType(t.value)}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 border ${
                                        isActive
                                            ? t.activeBg
                                            : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* HERO AMOUNT INPUT */}
                    <div className="space-y-1.5 bg-[#0a0e1a] p-3.5 rounded-2xl border border-white/10">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Valor do Lançamento
                        </label>
                        <div className="relative flex items-center">
                            <span className="text-xl font-black text-indigo-400 mr-2">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full bg-transparent text-2xl sm:text-3xl font-black text-white placeholder:text-slate-600 focus:outline-none tracking-tight"
                                required
                            />
                        </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição</label>
                        <input
                            type="text"
                            placeholder="Ex: Supermercado, Aluguel, Combustível..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-[#0a0e1a] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                            required
                        />
                    </div>

                    {/* SPENDER SELECTION (DE QUEM É?) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-indigo-400" /> Responsável / Pagador
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {[
                                { value: 'Comum', label: '🏡 Comum' },
                                { value: 'Eu', label: `💜 ${partner1}` },
                                { value: 'Outro', label: `💖 ${partner2}` },
                                { value: 'Filhos', label: '👶 Filhos' },
                            ].map((s) => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, quem: s.value })}
                                    className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 border truncate ${
                                        formData.quem === s.value
                                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/30'
                                            : 'bg-[#0a0e1a] text-slate-400 border-white/10 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CATEGORY & GROUP */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5 text-indigo-400" /> Categoria
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                                value={selectedGroup}
                                onChange={(e) => selectGroup(e.target.value)}
                                className="w-full bg-[#0a0e1a] border border-white/10 rounded-2xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                            >
                                <option value="">— Escolha o Grupo —</option>
                                {groupOptions.map((g) => (
                                    <option key={g.id} value={g.id}>{g.emoji} {g.label}</option>
                                ))}
                            </select>

                            <select
                                value={selectedCategory}
                                onChange={(e) => selectCategory(e.target.value)}
                                disabled={!selectedGroup}
                                className="w-full bg-[#0a0e1a] border border-white/10 rounded-2xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-40"
                            >
                                <option value="">— Categoria Específica —</option>
                                {categoryOptions.map((c) => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* ADVANCED DRAWER ACCORDION */}
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between p-3 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer active:scale-98"
                        >
                            <span className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-indigo-400" />
                                {showAdvanced ? 'Recolher Opções Avançadas' : 'Mais Opções (Data, Parcelas, Cartão, Fixa...)'}
                            </span>
                            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4 mt-3 p-4 rounded-2xl border border-white/10 bg-[#0a0e1a]/80 animate-fade-in">
                                {/* Date and Status */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data</label>
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status do Pagamento</label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, pago: !formData.pago })}
                                            className={`w-full py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                                formData.pago
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                            }`}
                                        >
                                            {formData.pago ? '✅ JÁ PAGO' : '⏳ PENDENTE'}
                                        </button>
                                    </div>
                                </div>

                                {/* Cartão de Crédito (quando type = credit ou meio de pagamento cartão) */}
                                {(formData.type === 'credit' || formData.payment_method === 'credit') && cartoes.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-purple-300 uppercase tracking-wider">Selecione o Cartão</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {cartoes.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, cardName: c.nome })}
                                                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
                                                        formData.cardName === c.nome
                                                            ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                                                            : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    💳 {c.nome}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Formato: Única / Fixa / Parcelada */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repetição / Parcelamento</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: 'unica', label: 'Única' },
                                            { value: 'fixa', label: '🔁 Fixa (24m)' },
                                            { value: 'parcelada', label: '📦 Parcelada' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, formato: opt.value })}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                    formData.formato === opt.value
                                                        ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                                                        : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {formData.formato === 'parcelada' && (
                                        <div className="space-y-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-fade-in">
                                            <label className="text-xs font-bold text-blue-300 uppercase tracking-wider">Quantidade de Parcelas</label>
                                            <input
                                                type="number"
                                                min="2"
                                                max="60"
                                                value={formData.parcelasN}
                                                onChange={(e) => setFormData({ ...formData, parcelasN: e.target.value })}
                                                className="w-full bg-slate-900 border border-blue-500/30 rounded-xl px-3 py-2 text-white font-bold"
                                            />
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                {[
                                                    { value: 'total', label: '💰 Valor Total (divide em N)' },
                                                    { value: 'parcela', label: '📆 Valor por Parcela' },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, valorTipo: opt.value })}
                                                        className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                                                            formData.valorTipo === opt.value
                                                                ? 'bg-blue-600 text-white border-blue-400'
                                                                : 'bg-slate-900 text-slate-400 border-white/10'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Destino / Origem */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Origem / Destino (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Nubank, Banco Inter, Dinheiro..."
                                        value={formData.destino}
                                        onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                        type="submit"
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                        <PlusCircle className="h-5 w-5" />
                        SALVAR LANÇAMENTO
                    </button>
                </form>
            </CardContent>
        </Card>
    );
}