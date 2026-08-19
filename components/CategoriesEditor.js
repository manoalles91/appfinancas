'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { getCategories, saveCustomCategories, resetCustomCategories } from '@/lib/categories';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all';

export default function CategoriesEditor() {
    const [groups, setGroups] = useState(() => clone(getCategories()));
    const { toast } = useToast();

    const updateGroup = (gIdx, patch) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, ...patch } : g)));
    const addGroup = () => setGroups(prev => [...prev, { id: 'grupo_' + Date.now(), label: 'Novo Grupo', emoji: '📌', categories: [] }]);
    const removeGroup = (gIdx) => setGroups(prev => prev.filter((_, i) => i !== gIdx));

    const addCategory = (gIdx) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, categories: [...g.categories, { name: 'Nova Categoria', items: [] }] } : g)));
    const removeCategory = (gIdx, cIdx) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, categories: g.categories.filter((_, j) => j !== cIdx) } : g)));
    const updateCategory = (gIdx, cIdx, patch) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, categories: g.categories.map((c, j) => (j === cIdx ? { ...c, ...patch } : c)) } : g)));
    const updateItems = (gIdx, cIdx, value) => updateCategory(gIdx, cIdx, { items: value.split(',').map(s => s.trim()).filter(Boolean) });

    const handleSave = () => {
        saveCustomCategories(groups);
        toast('Categorias salvas!');
    };

    const handleReset = () => {
        resetCustomCategories();
        setGroups(clone(getCategories()));
        toast('Categorias restauradas ao padrão.');
    };

    return (
        <Card className="animate-slide-up border-indigo-500/20">
            <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Plus className="h-5 w-5 text-indigo-400" /> Categorias & Itens
                        </h2>
                        <p className="text-xs text-slate-500">
                            Edite grupos, categorias e itens. Itens separados por vírgula. Salvo neste dispositivo.
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                        >
                            <RotateCcw className="h-3.5 w-3.5" /> RESTAURAR PADRÃO
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                        >
                            <Save className="h-3.5 w-3.5" /> SALVAR
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {groups.map((g, gIdx) => (
                        <div key={g.id || gIdx} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    value={g.emoji || '📌'}
                                    onChange={(e) => updateGroup(gIdx, { emoji: e.target.value })}
                                    className="w-12 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-center text-white focus:outline-none"
                                    title="Emoji do grupo"
                                />
                                <input
                                    value={g.label}
                                    onChange={(e) => updateGroup(gIdx, { label: e.target.value })}
                                    className={inputClass}
                                />
                                <button
                                    onClick={() => removeGroup(gIdx)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer shrink-0"
                                    title="Remover grupo"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {g.categories.map((c, cIdx) => (
                                    <div key={cIdx} className="space-y-1.5 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={c.name}
                                                onChange={(e) => updateCategory(gIdx, cIdx, { name: e.target.value })}
                                                className={inputClass}
                                                placeholder="Nome da categoria"
                                            />
                                            <button
                                                onClick={() => removeCategory(gIdx, cIdx)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer shrink-0"
                                                title="Remover categoria"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <input
                                            value={c.items.join(', ')}
                                            onChange={(e) => updateItems(gIdx, cIdx, e.target.value)}
                                            className={inputClass}
                                            placeholder="Itens separados por vírgula (ex: Luz, Água, Internet)"
                                        />
                                    </div>
                                ))}
                                <button
                                    onClick={() => addCategory(gIdx)}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 text-xs font-bold transition-all cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Adicionar Categoria
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={addGroup}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-slate-700 text-slate-400 hover:bg-slate-800/60 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                    <Plus className="h-4 w-4" /> Adicionar Grupo
                </button>
            </CardContent>
        </Card>
    );
}