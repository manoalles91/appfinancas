'use client';

import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`bg-[#1e293b] border w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in ${
          danger ? 'border-red-500/40' : 'border-slate-700'
        }`}
      >
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <h3 className={`text-xl font-bold flex items-center gap-2 ${danger ? 'text-red-400' : 'text-white'}`}>
            {danger && <AlertTriangle className="h-6 w-6 text-red-500" />}
            {title}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="h-6 w-6" />
          </button>
        </div>

        <p className="text-sm text-slate-300">{message}</p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 text-white font-bold rounded-xl transition-all shadow-lg text-xs cursor-pointer ${
              danger
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}