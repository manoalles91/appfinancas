'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Home, Plus, Edit3, Trash2, RefreshCw, Check, X, TrendingDown, CalendarDays, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const STORAGE_KEY = 'fincasal_financiamentos';

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value || 0);
};

const loadAll = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveAll = (list) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

const currentMonth = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

const emptyForm = {
    nome: 'Financiamento Casa',
    parcelaAtual: 1,
    total: 420,
    valorAtual: '',
    valorFinal: '',
    desconto: 0,
    dia: 10,
    inicio: currentMonth(),
    pagoAtual: true,
};

export default function Financiamentos({ transactions = [], onAddMany, onDeleteByNome }) {
    const { toast } = useToast();
    const txs = useMemo(() => (Array.isArray(transactions) ? transactions : []), [transactions]);

    const [financiamentos, setFinanciamentos] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);
    const [armedRegen, setArmedRegen] = useState(null);

    useEffect(() => {
        setFinanciamentos(loadAll());
    }, []);

    const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

    const computeDesconto = (f) => {
        const atual = parseFloat(String(f.valorAtual).replace(',', '.')) || 0;
        const final = parseFloat(String(f.valorFinal).replace(',', '.')) || 0;
        const parcAtual = parseInt(f.parcelaAtual, 10) || 0;
        const total = parseInt(f.total, 10) || 0;
        if (atual > 0 && final >= 0 && total > parcAtual) {
            return Math.max(0, (atual - final) / (total - parcAtual));
        }
        return 0;
    };

    const handleFieldChange = (field, value) => {
        const next = { ...form, [field]: value };
        if (field === 'valorAtual' || field === 'valorFinal' || field === 'parcelaAtual' || field === 'total') {
            next.desconto = computeDesconto(next);
        }
        setForm(next);
    };

    const save = () => {
        const valorAtual = parseFloat(String(form.valorAtual).replace(',', '.')) || 0;
        const total = parseInt(form.total, 10) || 0;
        const parcAtual = parseInt(form.parcelaAtual, 10) || 0;
        if (!form.nome.trim() || valorAtual <= 0 || total <= 0 || total <= parcAtual) {
            toast('Preencha nome, valor da parcela atual, parcela atual e total válidos.', 'error');
            return;
        }
        const item = {
            nome: form.nome.trim(),
            categoria: 'Moradia',
            subcategoria: 'Parcela Casa',
            parcelaAtual: parcAtual,
            total,
            valorAtual,
            valorFinal: parseFloat(String(form.valorFinal).replace(',', '.')) || 0,
            desconto: Math.max(0, parseFloat(String(form.desconto).replace(',', '.')) || 0),
            dia: Math.min(28, Math.max(1, parseInt(form.dia, 10) || 10)),
            inicio: form.inicio || currentMonth(),
            pagoAtual: !!form.pagoAtual,
            quem: 'Comum',
        };

        let list = [...financiamentos];
        if (editingIndex !== null) {
            list[editingIndex] = item;
        } else {
            list = [...list, item];
        }
        saveAll(list);
        setFinanciamentos(list);
        setShowForm(false);
        setEditingIndex(null);
        setForm(emptyForm);
        toast(editingIndex !== null ? 'Financiamento atualizado.' : 'Financiamento cadastrado.');
    };

    const remove = (idx) => {
        const list = financiamentos.filter((_, i) => i !== idx);
        saveAll(list);
        setFinanciamentos(list);
        toast('Financiamento removido.');
    };

    const statsFor = (f) => {
        const rows = txs.filter(
            (t) => t && t.description === f.nome && t.installment_info && String(t.installment_info).includes('/')
        );
        const paid = rows.filter((t) => t.pago).length;
        const lastPaid = paid > 0 ? f.parcelaAtual + paid - 1 : f.parcelaAtual - 1;
        const next = Math.min(lastPaid + 1, f.total);
        const nextValor = Math.max(0, f.valorAtual - (next - f.parcelaAtual) * f.desconto);
        const pctMensal = f.valorAtual > 0 ? (f.desconto / f.valorAtual) * 100 : 0;
        const progress = f.total > 0 ? Math.min(100, (Math.max(0, lastPaid) / f.total) * 100) : 0;
        return { rows, paid, lastPaid, next, nextValor, pctMensal, progress };
    };

    const generate = async (f) => {
        if (!onAddMany) return;
        setBusy(true);
        try {
            const payloads = [];
            const inicio = f.inicio || currentMonth();
            const base = new Date(inicio + '-01T12:00:00');
            for (let n = f.parcelaAtual; n <= f.total; n++) {
                const valor = Math.max(0, Math.round((f.valorAtual - (n - f.parcelaAtual) * f.desconto) * 100) / 100);
                const date = new Date(base.getFullYear(), base.getMonth() + (n - f.parcelaAtual), f.dia);
                payloads.push({
                    description: f.nome,
                    amount: valor,
                    type: 'expense',
                    category: f.categoria || 'Moradia',
                    subcategoria: f.subcategoria || 'Parcela Casa',
                    installment_info: `${n}/${f.total}`,
                    date: date.toISOString(),
                    fixa: true,
                    pago: n === f.parcelaAtual && f.pagoAtual,
                    payment_method: 'checking',
                    quem: f.quem || 'Comum',
                    destino: f.nome,
                });
            }
            await onAddMany(payloads, `${payloads.length} parcelas do ${f.nome} geradas!`);
            setArmedRegen(null);
        } finally {
            setBusy(false);
        }
    };

    const handleGenerateClick = (f) => {
        const st = statsFor(f);
        if (st.rows.length > 0) {
            if (armedRegen === f.nome) {
                if (!onDeleteByNome) return;
                onDeleteByNome(f.nome).then(() => generate(f));
            } else {
                setArmedRegen(f.nome);
            }
        } else {
            generate(f);
        }
    };

    const numFormatter = (v) => (v === '' || v === null || v === undefined ? '' : String(v).replace('.', ','));

    return (
        <Card className="animate-fade-in border-emerald-500/20 bg-emerald-950/10 backdrop-blur-md">
            <CardContent className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                            <Home className="h-5 w-5" /> Financiamentos
                        </h3>
                        <p className="text-xs text-slate-400">
                            Parcelas de casa/carro geradas automaticamente com redução mensal do valor.
                        </p>
                    </div>
                    {!showForm && (
                        <button
                            onClick={() => {
                                setForm(emptyForm);
                                setEditingIndex(null);
                                setShowForm(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-all cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" /> Adicionar Financiamento
                        </button>
                    )}
                </div>

                {showForm && (
                    <div className="rounded-2xl border border-emerald-500/25 bg-slate-900/40 p-4 space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Nome</label>
                                <Input
                                    value={form.nome}
                                    onChange={(e) => updateForm({ nome: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Parcela atual</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.parcelaAtual}
                                    onChange={(e) => handleFieldChange('parcelaAtual', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Total de parcelas</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.total}
                                    onChange={(e) => handleFieldChange('total', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Valor da parcela atual (R$)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Ex: 2262,93"
                                    value={form.valorAtual}
                                    onChange={(e) => handleFieldChange('valorAtual', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Valor da última parcela (R$)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Ex: 543,96 (opcional)"
                                    value={form.valorFinal}
                                    onChange={(e) => handleFieldChange('valorFinal', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Desconto mensal (R$)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={numFormatter(form.desconto)}
                                    onChange={(e) => updateForm({ desconto: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Dia de vencimento</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="28"
                                    value={form.dia}
                                    onChange={(e) => updateForm({ dia: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Início das parcelas (mês e ano)</label>
                                <Input
                                    type="month"
                                    value={form.inicio}
                                    onChange={(e) => updateForm({ inicio: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-500">A parcela atual (ex.: 21/420) será lançada no dia {form.dia || 10} desse mês.</p>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Desconto calculado automaticamente quando você informa a última parcela. Sua casa: (2.262,93 − 543,96) ÷ (420 − 21) = <strong className="text-emerald-400">R$ 4,31/mês</strong>.
                        </p>
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={form.pagoAtual}
                                onChange={(e) => updateForm({ pagoAtual: e.target.checked })}
                                className="accent-emerald-500 h-4 w-4"
                            />
                            A parcela atual já foi paga este mês
                        </label>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={save}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 text-slate-950 px-4 py-2 text-xs font-black hover:bg-emerald-400 transition-all cursor-pointer"
                            >
                                <Check className="h-3.5 w-3.5" /> Salvar
                            </button>
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingIndex(null);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 text-slate-300 px-4 py-2 text-xs font-bold hover:bg-slate-700 transition-all cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" /> Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {financiamentos.length === 0 && !showForm && (
                    <p className="text-xs text-slate-500 py-2">
                        Nenhum financiamento cadastrado. Adicione o da casa com a parcela atual (ex.: 21 de 420) e gere as parcelas automaticamente. 🏠
                    </p>
                )}

                {financiamentos.map((f, idx) => {
                    const st = statsFor(f);
                    const pct = Math.round(st.pctMensal * 100) / 100;
                    const remaining = Math.max(0, f.total - st.next + 1);
                    return (
                        <div key={idx} className="rounded-2xl border border-emerald-500/20 bg-slate-900/40 p-4 space-y-3 animate-fade-in">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-white">{f.nome}</h4>
                                    <span className="text-[10px] text-slate-500">
                                        vence dia {f.dia} • início {(() => { try { return new Date((f.inicio || currentMonth()) + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }); } catch { return ''; } })()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            setForm({ ...emptyForm, ...f, inicio: f.inicio || currentMonth(), valorAtual: numFormatter(f.valorAtual), valorFinal: numFormatter(f.valorFinal), desconto: numFormatter(f.desconto) });
                                            setEditingIndex(idx);
                                            setShowForm(true);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 text-slate-300 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-700 transition-all cursor-pointer"
                                    >
                                        <Edit3 className="h-3 w-3" /> Editar
                                    </button>
                                    <button
                                        onClick={() => remove(idx)}
                                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 text-red-400 px-2.5 py-1.5 text-[11px] font-bold hover:bg-red-500/20 transition-all cursor-pointer"
                                    >
                                        <Trash2 className="h-3 w-3" /> Remover
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                    <span className="text-slate-400">Parcela {Math.max(0, st.lastPaid)} de {f.total} paga</span>
                                    <span className="text-emerald-400">{Math.round(st.progress)}% concluído</span>
                                </div>
                                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                        style={{ width: `${st.progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3 text-xs">
                                <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Próxima parcela ({st.next}/{f.total})</p>
                                    <p className="text-sm font-black text-white">{formatCurrency(st.nextValor)}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                        <TrendingDown className="h-3 w-3 text-emerald-400" /> Redução mensal
                                    </p>
                                    <p className="text-sm font-black text-emerald-400">R$ {f.desconto.toFixed(2)} (~{pct}%)</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3 text-emerald-400" /> Restantes
                                    </p>
                                    <p className="text-sm font-black text-white">{remaining} parcelas</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] text-emerald-300/70">
                                    Sua parcela reduz aproximadamente <strong className="text-emerald-300">R$ {f.desconto.toFixed(2)} por mês</strong> (~{pct}% ao mês).
                                </p>
                                <button
                                    onClick={() => handleGenerateClick(f)}
                                    disabled={busy}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer disabled:opacity-50 ${st.rows.length > 0
                                        ? (armedRegen === f.nome ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'bg-slate-800 text-amber-300 hover:bg-slate-700')
                                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                        }`}
                                >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (armedRegen === f.nome ? <RefreshCw className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />)}
                                    {st.rows.length > 0
                                        ? (armedRegen === f.nome ? 'CONFIRMAR (apaga e recria)' : 'REGENERAR PARCELAS')
                                        : `GERAR PARCELAS (${f.total - f.parcelaAtual + 1} restantes)`}
                                </button>
                            </div>
                            {st.rows.length > 0 && (
                                <p className="text-[10px] text-slate-500">
                                    {st.rows.length} parcelas já lançadas • {st.paid} pagas • progresso calculado automaticamente ao marcar como pago.
                                </p>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}