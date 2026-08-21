'use client';

import { useState, useEffect } from 'react';
import { Pencil, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SALDO_KEYS = { alle: 'saldo_alle', kelly: 'saldo_kelly' };

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export default function Balances({ partner1 = 'Alle', partner2 = 'Kelly', onChange }) {
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
        setDraft(String(current).replace('.', ','));
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
        const val = parseFloat(String(draft).replace(',', '.')) || 0;
        if (editing === 'alle') {
            setAlle(val);
            persist('alle', val);
        } else if (editing === 'kelly') {
            setKelly(val);
            persist('kelly', val);
        }
        setEditing(null);
    };

    const input = (who, value) => {
        if (editing === who) {
            return (
                <div className="flex items-center gap-1.5">
                    <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={save}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') save();
                            if (e.key === 'Escape') setEditing(null);
                        }}
                        className="w-24 bg-slate-900 border border-indigo-500/50 rounded-lg px-2 py-1 text-sm font-bold text-white text-right focus:outline-none"
                    />
                    <button onClick={save} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded cursor-pointer" title="Salvar">
                        <Check className="h-4 w-4" />
                    </button>
                </div>
            );
        }
        return (
            <button
                onClick={() => startEdit(who, value)}
                className="group flex items-center gap-2 cursor-pointer"
                title={`Editar saldo de ${who === 'alle' ? partner1 : partner2}`}
            >
                <span className={`text-xl font-black ${value >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatCurrency(value)}
                </span>
                <Pencil className="h-3.5 w-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </button>
        );
    };

    const total = (alle ?? 0) + (kelly ?? 0);

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-purple-400">Saldo {partner1}</p>
                {input('alle', alle ?? 0)}
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-400">Saldo {partner2}</p>
                {input('kelly', kelly ?? 0)}
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Saldo Atual</p>
                <p className={`text-xl font-black ${total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(total)}
                </p>
            </div>
        </div>
    );
}