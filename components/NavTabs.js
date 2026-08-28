'use client';

import { Plus } from 'lucide-react';

export default function NavTabs({ tabs, active, onChange, onQuickAdd, pendingBadges = {} }) {
  // Organiza para colocar o botão central entre as abas
  const firstHalf = tabs.slice(0, 2); // Início, Finanças
  const secondHalf = tabs.slice(2); // Desejos, Tarefas, Config

  const renderTabButton = (t) => {
    const Icon = t.icon;
    const isActive = active === t.id;
    const badgeCount = pendingBadges[t.id] || 0;

    return (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all duration-150 cursor-pointer active:scale-90 ${
          isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {isActive && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
        )}
        <div className="relative">
          <Icon className={`h-4.5 w-4.5 transition-transform duration-150 ${isActive ? 'scale-110 text-indigo-400' : 'text-slate-400'}`} />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-2 flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full text-[8px] font-black bg-rose-500 text-white shadow-sm shadow-rose-500/50">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
        <span className={`text-[9px] tracking-tight truncate max-w-[54px] ${isActive ? 'font-black text-white' : 'font-medium text-slate-400'}`}>
          {t.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-2 bg-[#121827]/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-xl">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          const badgeCount = pendingBadges[t.id] || 0;

          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/40 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 transition-transform duration-150 ${isActive ? 'scale-105 text-white' : 'text-slate-400'}`} />
              <span>{t.label}</span>

              {badgeCount > 0 && (
                <span className="flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-md shadow-rose-500/40 animate-pulse">
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Bottom Bar Navigation (Ultra-Compact, Centered FAB) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e1a]/95 backdrop-blur-2xl border-t border-white/10 px-1 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] flex items-center justify-between shadow-[0_-6px_24px_rgba(0,0,0,0.6)]">
        {firstHalf.map(renderTabButton)}

        {/* Central Action Button */}
        {onQuickAdd && (
          <div className="flex-1 flex justify-center items-center px-1">
            <button
              onClick={onQuickAdd}
              aria-label="Novo lançamento"
              className="flex items-center justify-center -mt-4 h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/40 border-2 border-[#0a0e1a] active:scale-90 transition-transform cursor-pointer"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        )}

        {secondHalf.map(renderTabButton)}
      </nav>
    </>
  );
}