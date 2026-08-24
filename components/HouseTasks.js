'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    CheckSquare, 
    Square, 
    Plus, 
    Trash2, 
    Edit3, 
    ShoppingCart, 
    RotateCcw, 
    Sparkles, 
    Calendar, 
    Clock, 
    X, 
    CheckCircle2, 
    Filter,
    Flame,
    ListTodo
} from 'lucide-react';

const RECURRENCE_OPTIONS = [
    { value: 'none', label: 'Única (Sem repetição)' },
    { value: 'daily', label: '📅 Diária' },
    { value: 'weekly', label: '📅 Semanal' },
    { value: 'monthly', label: '📆 Mensal' },
    { value: 'semiannual', label: '🔄 Semestral (6 meses)' },
    { value: 'annual', label: '🌟 Anual' },
];

const TASK_CATEGORIES = [
    { value: 'geral', label: 'Afazeres Gerais', emoji: '📋' },
    { value: 'mercado', label: 'Mercado & Feira', emoji: '🛒' },
    { value: 'limpeza', label: 'Limpeza & Faxina', emoji: '🧹' },
    { value: 'manutencao', label: 'Manutenção & Casa', emoji: '🛠️' },
    { value: 'filhos', label: 'Filhos & Escola', emoji: '👶' },
];

export default function HouseTasks({
    tasks = [],
    onAdd,
    onToggle,
    onUpdate,
    onDelete,
    onClearCompleted,
    partner1 = 'Alle',
    partner2 = 'Kelly'
}) {
    const [activeTab, setActiveTab] = useState('todas'); // todas | mercado | rotinas
    const [assignedFilter, setAssignedFilter] = useState('all'); // all | Alle | Kelly | Casa | Filhos
    const [quickInput, setQuickInput] = useState('');
    const [quickAssigned, setQuickAssigned] = useState('Casa');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [modalData, setModalData] = useState({
        title: '',
        assigned_to: 'Casa',
        category: 'geral',
        recurrence: 'none',
        due_date: '',
        notes: ''
    });

    const openAddModal = () => {
        setEditingTask(null);
        setModalData({
            title: '',
            assigned_to: 'Casa',
            category: activeTab === 'mercado' ? 'mercado' : 'geral',
            recurrence: activeTab === 'rotinas' ? 'monthly' : 'none',
            due_date: '',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (t) => {
        setEditingTask(t);
        setModalData({
            title: t.title || '',
            assigned_to: t.assigned_to || 'Casa',
            category: t.category || 'geral',
            recurrence: t.recurrence || 'none',
            due_date: t.due_date || '',
            notes: t.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        if (!quickInput.trim()) return;

        const payload = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            title: quickInput.trim(),
            assigned_to: quickAssigned,
            category: activeTab === 'mercado' ? 'mercado' : 'geral',
            recurrence: activeTab === 'rotinas' ? 'monthly' : 'none',
            due_date: '',
            completed: false,
            created_at: new Date().toISOString()
        };

        await onAdd(payload);
        setQuickInput('');
    };

    const handleModalSubmit = async (e) => {
        e.preventDefault();
        if (!modalData.title.trim()) return;

        const payload = {
            id: editingTask ? editingTask.id : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
            title: modalData.title.trim(),
            assigned_to: modalData.assigned_to,
            category: modalData.category,
            recurrence: modalData.recurrence,
            due_date: modalData.due_date || '',
            notes: modalData.notes?.trim() || '',
            completed: editingTask ? editingTask.completed : false,
            updated_at: new Date().toISOString()
        };

        if (editingTask) {
            await onUpdate(payload);
        } else {
            payload.created_at = new Date().toISOString();
            await onAdd(payload);
        }

        setIsModalOpen(false);
    };

    // Filtered tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (!t) return false;

            // View Tabs filter
            if (activeTab === 'mercado' && t.category !== 'mercado') return false;
            if (activeTab === 'rotinas' && (!t.recurrence || t.recurrence === 'none')) return false;

            // Assigned filter
            if (assignedFilter !== 'all' && t.assigned_to !== assignedFilter) return false;

            return true;
        }).sort((a, b) => {
            // Pending first, then by date
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }, [tasks, activeTab, assignedFilter]);

    const pendingTasks = useMemo(() => filteredTasks.filter(t => !t.completed), [filteredTasks]);
    const completedTasks = useMemo(() => filteredTasks.filter(t => t.completed), [filteredTasks]);

    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const done = completedTasks.length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, percent };
    }, [filteredTasks, completedTasks]);

    const getAssigneeBadge = (assigned) => {
        if (assigned === 'Alle' || assigned === partner1) {
            return <span className="text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/25">{partner1}</span>;
        }
        if (assigned === 'Kelly' || assigned === partner2) {
            return <span className="text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/25">{partner2}</span>;
        }
        if (assigned === 'Filhos') {
            return <span className="text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/25">👶 Filhos</span>;
        }
        return <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/25">🏡 Casa</span>;
    };

    const getRecurrenceBadge = (recurrence) => {
        if (!recurrence || recurrence === 'none') return null;
        const opt = RECURRENCE_OPTIONS.find(x => x.value === recurrence);
        return (
            <span className="text-[10px] font-black uppercase bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1">
                <RotateCcw className="h-2.5 w-2.5" />
                {opt?.label || recurrence}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                        <CheckSquare className="h-6 w-6 text-indigo-400" />
                        Tarefas & Rotinas da Casa
                    </h2>
                    <p className="text-sm text-slate-400">
                        Checklist do dia a dia, compras de feira/mercado e rotinas de manutenção.
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-indigo-500/20 border border-indigo-400/30 hover:scale-105 active:scale-95"
                >
                    <Plus className="h-4 w-4" />
                    Nova Tarefa
                </button>
            </div>

            {/* Visual Progress Bar */}
            <Card className="bg-[#1e293b]/70 border-slate-800 shadow-xl overflow-hidden">
                <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300">
                            Progresso: <strong className="text-indigo-400">{stats.done}</strong> de <strong className="text-white">{stats.total}</strong> concluídas
                        </span>
                        <span className="font-extrabold text-emerald-400">{stats.percent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500 rounded-full"
                            style={{ width: `${stats.percent}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Quick Add Bar (Inline) */}
            <form onSubmit={handleQuickAdd} className="flex gap-2 items-center bg-[#1e293b] p-2 rounded-2xl border border-slate-700/80 shadow-lg">
                <Input
                    placeholder={
                        activeTab === 'mercado' 
                            ? "Adicionar item à feira/mercado (ex: Leite, Ovos, Pão de forma)..." 
                            : "Adicionar tarefa rápida (ex: Tirar lixo, pagar internet, lavar carro)..."
                    }
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-sm flex-1 text-white"
                />
                <select
                    value={quickAssigned}
                    onChange={(e) => setQuickAssigned(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 rounded-xl px-3 py-2.5 h-[38px] cursor-pointer hidden sm:block"
                >
                    <option value="Casa">🏡 Casa</option>
                    <option value={partner1}>{partner1}</option>
                    <option value={partner2}>{partner2}</option>
                    <option value="Filhos">👶 Filhos</option>
                </select>
                <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer h-[38px]"
                >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Adicionar</span>
                </button>
            </form>

            {/* Navigation Tabs (Todas / Mercado / Rotinas) & Assignee Filter */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 items-stretch sm:items-center">
                <div className="flex gap-1.5 p-1 rounded-2xl bg-slate-900/60 border border-slate-800">
                    {[
                        { id: 'todas', label: '📋 Todas', count: tasks.length },
                        { id: 'mercado', label: '🛒 Mercado / Feira', count: tasks.filter(t => t.category === 'mercado').length },
                        { id: 'rotinas', label: '🔄 Rotinas', count: tasks.filter(t => t.recurrence && t.recurrence !== 'none').length }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Filter by Person */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {[
                        { id: 'all', label: 'Todos' },
                        { id: 'Casa', label: '🏡 Casa' },
                        { id: partner1, label: partner1 },
                        { id: partner2, label: partner2 },
                        { id: 'Filhos', label: '👶 Filhos' },
                    ].map((af) => (
                        <button
                            key={af.id}
                            onClick={() => setAssignedFilter(af.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                                assignedFilter === af.id
                                    ? 'bg-slate-700 text-white border border-slate-600'
                                    : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                        >
                            {af.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-4">
                {/* Pendentes */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
                            ⏳ A Fazer ({pendingTasks.length})
                        </span>
                    </div>

                    {pendingTasks.length === 0 ? (
                        <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-800/60 text-slate-500 text-xs">
                            🎉 Nenhuma tarefa pendente! Tudo em dia.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pendingTasks.map((t) => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between p-3.5 bg-[#1e293b] hover:bg-[#1e293b]/90 border border-slate-800 rounded-2xl transition-all group shadow-md"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <button
                                            onClick={() => onToggle(t.id, true)}
                                            className="h-6 w-6 rounded-lg border border-slate-600 flex items-center justify-center text-transparent hover:text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all cursor-pointer shrink-0"
                                            title="Marcar como concluída"
                                        >
                                            <Square className="h-5 w-5" />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white truncate">
                                                {t.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {getAssigneeBadge(t.assigned_to)}
                                                {getRecurrenceBadge(t.recurrence)}
                                                {t.due_date && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-800">
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                )}
                                                {t.notes && (
                                                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                        • {t.notes}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                            onClick={() => openEditModal(t)}
                                            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                                            title="Editar"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(t.id)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Concluídas */}
                {completedTasks.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-slate-800">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                ✅ Concluídas ({completedTasks.length})
                            </span>
                            {onClearCompleted && (
                                <button
                                    onClick={onClearCompleted}
                                    className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                >
                                    Limpar todas concluídas
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {completedTasks.map((t) => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl opacity-70 hover:opacity-100 transition-all group"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <button
                                            onClick={() => onToggle(t.id, false)}
                                            className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center transition-all cursor-pointer shrink-0"
                                            title="Desmarcar (voltar para a fazer)"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-400 line-through decoration-slate-600">
                                                {t.title}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => onDelete(t.id)}
                                        className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes da Tarefa */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <CheckSquare className="h-5 w-5 text-indigo-400" />
                                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleModalSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">O que precisa ser feito?</label>
                                <Input
                                    placeholder="Ex: Trocar filtro do purificador de água, comprar ração..."
                                    value={modalData.title}
                                    onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                                    required
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Responsável</label>
                                    <select
                                        value={modalData.assigned_to}
                                        onChange={(e) => setModalData({ ...modalData, assigned_to: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer h-[42px]"
                                    >
                                        <option value="Casa">🏡 Casa / Juntos</option>
                                        <option value={partner1}>{partner1} (Pessoal)</option>
                                        <option value={partner2}>{partner2} (Pessoal)</option>
                                        <option value="Filhos">👶 Filhos</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                                    <select
                                        value={modalData.category}
                                        onChange={(e) => setModalData({ ...modalData, category: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer h-[42px]"
                                    >
                                        {TASK_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repetição / Rotina</label>
                                    <select
                                        value={modalData.recurrence}
                                        onChange={(e) => setModalData({ ...modalData, recurrence: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer h-[42px]"
                                    >
                                        {RECURRENCE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Limite (Opcional)</label>
                                    <Input
                                        type="date"
                                        value={modalData.due_date}
                                        onChange={(e) => setModalData({ ...modalData, due_date: e.target.value })}
                                        className="bg-slate-900 border-slate-700 text-white text-xs h-[42px]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Observações / Detalhes</label>
                                <Input
                                    placeholder="Ex: Marca do refil, endereço ou detalhes extras..."
                                    value={modalData.notes}
                                    onChange={(e) => setModalData({ ...modalData, notes: e.target.value })}
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

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
                                    {editingTask ? 'SALVAR ALTERAÇÕES' : 'CRIAR TAREFA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
