'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { fetchAudit } from '@/lib/audit';
import { Card, CardContent } from '@/components/ui/card';

const ACTION_LABELS = {
  update: 'Edição',
  split: 'Dividir',
  adjust_amount: 'Ajustar valor',
  mark_paid: 'Marcar pago',
  mark_unpaid: 'Marcar não pago',
  delete: 'Excluir',
  reset_all: 'Reset total',
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAudit().then((rows) => {
      if (!active) return;
      setLogs(rows);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (loaded && logs.length === 0) return null;

  return (
    <Card className="animate-slide-up border-indigo-500/20">
      <CardContent className="p-6 space-y-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-400" /> Histórico de Alterações
        </h2>
        {!loaded ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-2 text-xs bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2">
                <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold capitalize">
                  {ACTION_LABELS[l.action] || l.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate">{l.description || '—'}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(l.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
