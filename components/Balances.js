'use client';

import { useState, useEffect } from 'react';
import { Pencil, Wallet, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';

const SALDO_KEYS = { alle: 'saldo_alle', kelly: 'saldo_kelly' };

export default function Balances({ partner1 = 'Alle', partner2 = 'Kelly', onChange, isPrivate = false }) {
    const [alle, setAlle] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const a = localStorage.getItem('fincasal_saldo_alle');
        return a === null ? 0 : parseFloat(a) || 0;
    });
    const [kelly, setKelly] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const k = localStorage.getItem('fincasal_saldo_kelly');
        return k === null ? 0 : parseFloat(k) || 0;
    });
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        let active = true;
        const onSaldoChanged = () => {
            if (typeof window === 'undefined') return;
            const a = localStorage.getItem('fincasal_saldo_alle');
            const k = localStorage.getItem('fincasal_saldo_kelly');
            if (a !== null) setAlle(parseFloat(a) || 0);
            if (k !== null) setKelly(parseFloat(k) || 0);
        };
        window.addEventListener('fincasal:saldo-changed', onSaldoChanged);
        (async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('key,value');
                if (error || !data || !active) return;
                for (const row of data) {
                    if (row.key === SALDO_KEYS.alle) {
                        const val = parseFloat(row.value) || 0;
                        setAlle(val);
                        try { localStorage.setItem('fincasal_saldo_alle', String(val)); } catch {}
                    }
                    if (row.key === SALDO_KEYS.kelly) {
                        const val = parseFloat(row.value) || 0;
                        setKelly(val);
                        try { localStorage.setItem('fincasal_saldo_kelly', String(val)); } catch {}
                    }
                }
            } catch {}
        })();
        return () => {
            window.removeEventListener('fincasal:saldo-changed', onSaldoChanged);
            active = false;
        };
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
        try {
            localStorage.setItem(who === 'alle' ? 'fincasal_saldo_alle' : 'fincasal_saldo_kelly', String(val));
        } catch {}
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: SALDO_KEYS[who], value: String(val) }, { onConflict: 'key' });
            if (error) console.error('Error saving saldo:', error.message);
        } catch (err) {
            console.error('Error saving saldo:', err.message);
        }
        try {
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fincasal:saldo-changed'));
        } catch {}
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
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* Saldo Partner 1 */}
                <div
                    onClick={() => startEdit('alle', alle ?? 0)}
                    className="relative group p-2.5 sm:p-3.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/25 transition-all duration-150 cursor-pointer active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1 truncate">
                            <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" /> {partner1}
                        </span>
                        <Pencil className="h-2.5 w-2.5 text-purple-400/50 group-hover:text-purple-300 shrink-0" />
                    </div>
                    <p className={`text-sm sm:text-lg font-black tracking-tight truncate ${(alle ?? 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {displayAmount(alle ?? 0)}
                    </p>
                </div>

                {/* Saldo Partner 2 */}
                <div
                    onClick={() => startEdit('kelly', kelly ?? 0)}
                    className="relative group p-2.5 sm:p-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 transition-all duration-150 cursor-pointer active:scale-[0.98]"
                >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1 truncate">
                            <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" /> {partner2}
                        </span>
                        <Pencil className="h-2.5 w-2.5 text-rose-400/50 group-hover:text-rose-300 shrink-0" />
                    </div>
                    <p className={`text-sm sm:text-lg font-black tracking-tight truncate ${(kelly ?? 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {displayAmount(kelly ?? 0)}
                    </p>
                </div>
            </div>

            {/* Modal de Edição Rápida de Saldo */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#121827] border border-white/15 w-full max-w-sm rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3 animate-scale-in">
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-indigo-400" />
                                Ajustar Saldo — {editing === 'alle' ? partner1 : partner2}
                            </h3>
                            <button
                                onClick={() => setEditing(null)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Valor em Conta (R$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
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
                                    className="w-full bg-[#0a0e1a] border border-white/15 focus:border-indigo-500 rounded-xl pl-10 pr-3 py-2.5 text-base font-black text-white focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="flex-1 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black text-white cursor-pointer shadow-md"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}