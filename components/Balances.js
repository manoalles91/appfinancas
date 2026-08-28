'use client';

import { useState, useEffect } from 'react';
import { Pencil, Check, X, Wallet, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';

const SALDO_KEYS = { alle: 'saldo_alle', kelly: 'saldo_kelly' };

export default function Balances({ partner1 = 'Alle', partner2 = 'Kelly', onChange, isPrivate = false }) {
    const [alle, setAlle] = useState(null);
    const [kelly, setKelly] = useState(null);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        const a = localStorage.getItem('fincasal_saldo_alle');
        const k = localStorage.getItem('fincasal_saldo_kelly');
        setAlle(a === null ? 0 : parseFloat(a) || 0);
        setKelly(k === null ? 0 : parseFloat(k) || 0);

        let active = true;
        (async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('key,value');
                if (error || !data || !active) return;
                for (const row of data) {
                    if (row.key === SALDO_KEYS.alle) setAlle(parseFloat(row.value) || 0);
                    if (row.key === SALDO_KEYS.kelly) setKelly(parseFloat(row.value) || 0);
                }
            } catch {}
        })();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (alle === null || kelly === null) return;
        onChange && onChange(alle + kelly);
    }, [alle, kelly, onChange]);

    const startEdit = (who, current) => {
        setEditing(who);
        setDraft(String(current || 0).replace('.', ','));
    };

    const persist = async (who, val) => {
        localStorage.setItem(who === 'alle' ? 'fincasal_saldo_alle' : 'fincasal_saldo_kelly', val);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: SALDO_KEYS[who], value: String(val) }, { onConflict: 'key' });
            if (error) console.error('Error saving saldo:', error.message);
        } catch (err) {
            console.error('Error saving saldo:', err.message);
        }
    };

    const save = () => {
        const clean = String(draft).replace(/\./g, '').replace(',', '.');
        const val = parseFloat(clean) || 0;
        if (editing === 'alle') {
            setAlle(val);
            persist('alle', val);
        } else if (editing === 'kelly') {
            setKelly(val);
            persist('kelly', val);
        }
        setEditing(null);
    };

    const displayAmount = (val) => {
        if (isPrivate) return '••••••';
        return formatCurrency(val);
    };

    return (
        <>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {/* Saldo Partner 1 */}
                <div
                    onClick={() => startEdit('alle', alle ?? 0)}
                    className="relative group p-3 sm:p-4 rounded-2xl bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/25 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1 truncate">
                            <User className="h-3 w-3 shrink-0" /> {partner1}
                        </span>
                        <Pencil className="h-3 w-3 text-purple-400/50 group-hover:text-purple-300 transition-colors shrink-0" />
                    </div>
                    <p className={`text-base sm:text-xl font-black tracking-tight truncate ${(alle ?? 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {displayAmount(alle ?? 0)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-purple-300/60 mt-0.5">Toque para ajustar</p>
                </div>

                {/* Saldo Partner 2 */}
                <div
                    onClick={() => startEdit('kelly', kelly ?? 0)}
                    className="relative group p-3 sm:p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1 truncate">
                            <User className="h-3 w-3 shrink-0" /> {partner2}
                        </span>
                        <Pencil className="h-3 w-3 text-rose-400/50 group-hover:text-rose-300 transition-colors shrink-0" />
                    </div>
                    <p className={`text-base sm:text-xl font-black tracking-tight truncate ${(kelly ?? 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {displayAmount(kelly ?? 0)}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-rose-300/60 mt-0.5">Toque para ajustar</p>
                </div>
            </div>

            {/* Modal de Edição Rápida de Saldo */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#121827] border border-white/15 w-full max-w-sm rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-scale-in">
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-indigo-400" />
                                Ajustar Saldo — {editing === 'alle' ? partner1 : partner2}
                            </h3>
                            <button
                                onClick={() => setEditing(null)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Valor Atual em Conta (R$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">R$</span>
                                <input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') save();
                                        if (e.key === 'Escape') setEditing(null);
                                    }}
                                    className="w-full bg-[#0a0e1a] border border-white/15 focus:border-indigo-500 rounded-2xl pl-12 pr-4 py-3.5 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Digite o saldo real do banco/carteira para atualizar as projeções da casa.
                            </p>
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-all border border-white/10 text-xs cursor-pointer active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/30 text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <Check className="h-4 w-4" /> Salvar Saldo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}