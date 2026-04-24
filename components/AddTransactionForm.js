'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, CreditCard, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '@/components/CategoryIcon';

const TRANSACTION_TYPES = [
    { value: 'expense', label: 'Despesa', icon: ArrowDownLeft, color: 'text-red-400', active: 'bg-red-500/20 border-red-500/40 text-red-300' },
    { value: 'income', label: 'Receita', icon: ArrowUpRight, color: 'text-emerald-400', active: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
    { value: 'credit', label: 'Cartão', icon: CreditCard, color: 'text-purple-400', active: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
];

export default function AddTransactionForm({ onAdd, cartoes = [] }) {
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: 'expense',
        category: '',
        date: new Date().toISOString().split('T')[0],
        installments: 1,
        cardName: '',
        pago: false,
        fixa: false,
        payment_method: 'checking',
        quem: 'Comum',
        subcategoria: '',
        destino: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const baseAmount = parseFloat(formData.amount) || 0;
        if (baseAmount <= 0) {
            alert('Por favor, insira um valor válido.');
            return;
        }

        if (formData.type === 'credit' && formData.installments > 1) {
            const installmentAmount = Math.round((baseAmount / formData.installments) * 100) / 100;
            const baseDate = new Date(formData.date);

            for (let i = 0; i < formData.installments; i++) {
                const installDate = new Date(baseDate);
                installDate.setMonth(installDate.getMonth() + i);

                onAdd({
                    id: crypto.randomUUID(),
                    description: `${formData.description} (${i + 1}/${formData.installments})`,
                    amount: installmentAmount,
                    type: 'credit',
                    category: formData.category || 'Cartão',
                    date: installDate.toISOString(),
                    cardName: formData.cardName || 'Cartão Principal',
                    installmentInfo: `${i + 1}/${formData.installments}`,
                    pago: formData.pago,
                    payment_method: 'credit',
                    quem: formData.quem,
                    subcategoria: formData.subcategoria,
                    destino: formData.destino,
                });
            }
        } else if (formData.fixa) {
            const baseDate = new Date(formData.date);
            for (let i = 0; i < 12; i++) {
                const recurrenceDate = new Date(baseDate);
                recurrenceDate.setMonth(recurrenceDate.getMonth() + i);

                onAdd({
                    id: crypto.randomUUID(),
                    description: formData.description,
                    amount: baseAmount,
                    type: formData.type,
                    category: formData.category || 'Fixa',
                    date: recurrenceDate.toISOString(),
                    fixa: true,
                    pago: i === 0 ? formData.pago : false,
                    payment_method: formData.type === 'credit' ? 'credit' : formData.payment_method,
                    quem: formData.quem,
                    subcategoria: formData.subcategoria,
                    destino: formData.destino,
                });
            }
        } else {
            onAdd({
                id: crypto.randomUUID(),
                description: formData.description,
                amount: baseAmount,
                type: formData.type,
                category: formData.category || (formData.type === 'income' ? 'Salário' : 'Compras'),
                date: new Date(formData.date).toISOString(),
                cardName: formData.type === 'credit' ? (formData.cardName || 'Cartão Principal') : undefined,
                pago: formData.pago,
                fixa: false,
                payment_method: formData.type === 'credit' ? 'credit' : (formData.type === 'income' ? 'checking' : formData.payment_method),
                quem: formData.quem,
                subcategoria: formData.subcategoria,
                destino: formData.destino,
            });
        }

        setFormData({
            description: '',
            amount: '',
            type: 'expense',
            category: '',
            date: new Date().toISOString().split('T')[0],
            installments: 1,
            cardName: '',
            pago: false,
            fixa: false,
            payment_method: 'checking',
            quem: 'Comum',
            subcategoria: '',
            destino: '',
        });
    };

    return (
        <Card className="animate-slide-up">
            <CardHeader>
                <CardTitle className="text-base">Nova Transação</CardTitle>
                <CardDescription>Registre uma despesa, receita ou compra no cartão.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Selector */}
                    <div className="flex gap-2">
                        {TRANSACTION_TYPES.map((t) => {
                            const Icon = t.icon;
                            const isActive = formData.type === t.value;
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: t.value })}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${isActive
                                            ? t.active
                                            : 'border-input bg-secondary/30 text-muted-foreground hover:bg-secondary/60'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</label>
                        <Input
                            placeholder="Ex: Aluguel, Supermercado..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />
                    </div>

                    {/* Payment Method Selector - Only for Expenses */}
                    {formData.type === 'expense' && (
                        <div className="space-y-1.5 animate-fade-in">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meio de Pagamento</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, payment_method: 'checking', cardName: '' })}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                        formData.payment_method === 'checking'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-secondary/30 text-slate-500 border-slate-800'
                                    }`}
                                >
                                    🏦 CONTA CORRENTE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, payment_method: 'credit', cardName: cartoes[0]?.nome || '' })}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                        formData.payment_method === 'credit'
                                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                        : 'bg-secondary/30 text-slate-500 border-slate-800'
                                    }`}
                                >
                                    💳 CARTÃO DE CRÉDITO
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Card Selection - Only when credit is selected */}
                    {formData.type === 'expense' && formData.payment_method === 'credit' && cartoes.length > 0 && (
                        <div className="space-y-1.5 animate-fade-in">
                            <label className="text-xs font-medium text-purple-300 uppercase tracking-wide">Qual Cartão?</label>
                            <div className="flex gap-2">
                                {cartoes.map((card) => (
                                    <button
                                        key={card.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, cardName: card.nome })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                            formData.cardName === card.nome
                                            ? 'bg-purple-500/20 text-white border-purple-500/50'
                                            : 'bg-purple-500/5 text-purple-300 border-purple-500/20 hover:bg-purple-500/10'
                                        }`}
                                    >
                                        {card.nome}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Amount & Date row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor (R$)</label>
                            <Input
                                type="number"
                                placeholder="0,00"
                                step="0.01"
                                min="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data</label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    {/* Status & Fixa row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, pago: !formData.pago })}
                                className={`w-full flex items-center justify-center gap-2 h-[38px] rounded-lg border font-bold text-xs transition-all ${
                                    formData.pago 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                                }`}
                            >
                                {formData.pago ? 'PAGO' : 'PENDENTE'}
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Despesa Fixa?</label>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, fixa: !formData.fixa })}
                                className={`w-full flex items-center justify-center gap-2 h-[38px] rounded-lg border font-bold text-xs transition-all ${
                                    formData.fixa 
                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' 
                                    : 'bg-secondary/30 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                            >
                                {formData.fixa ? 'SIM (12 MESES)' : 'NÃO'}
                            </button>
                        </div>
                    </div>

                    {/* Category row */}
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="flex h-[38px] w-full rounded-lg border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all duration-200 cursor-pointer"
                            >
                                <option value="">Selecionar...</option>
                                <option value="Contas Fixas">Contas Fixas (Luz, Água...)</option>
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável (Quem?)</label>
                            <select
                                value={formData.quem}
                                onChange={(e) => setFormData({ ...formData, quem: e.target.value })}
                                className="flex h-[38px] w-full rounded-lg border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all duration-200 cursor-pointer"
                            >
                                <option value="Comum">Comum</option>
                                <option value="Eu">Eu</option>
                                <option value="Outro">Outro</option>
                            </select>
                        </div>
                    </div>

                    {/* Subcategory & Destino row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcategoria</label>
                            <Input
                                placeholder="Ex: Jantar, Academia..."
                                value={formData.subcategoria}
                                onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Destino/Origem</label>
                            <Input
                                placeholder="Ex: Casa, Trabalho..."
                                value={formData.destino}
                                onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Credit card specific fields */}
                    {formData.type === 'credit' && (
                        <div className="space-y-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 animate-fade-in">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-purple-300 uppercase tracking-wide">Nome do Cartão</label>
                                <Input
                                    placeholder="Ex: Nubank, Inter..."
                                    value={formData.cardName}
                                    onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-purple-300 uppercase tracking-wide">Parcelas</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="48"
                                    value={formData.installments}
                                    onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) || 1 })}
                                />
                                {formData.installments > 1 && formData.amount && (
                                    <p className="text-xs text-purple-300/70">
                                        {formData.installments}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(formData.amount) / formData.installments)}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <Button type="submit" className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
