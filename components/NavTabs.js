'use client';

import { Plus } from 'lucide-react';

export default function NavTabs({ tabs, active, onChange, onQuickAdd, pendingBadges = {} }) {
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
              className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/40 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110 text-white' : 'text-slate-400'}`} />
              <span>{t.label}</span>

              {badgeCount > 0 && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-md shadow-rose-500/40 animate-pulse">
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Bottom Bar Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0b0f19]/90 backdrop-blur-2xl border-t border-white/10 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex items-center justify-around shadow-[0_-8px_32px_rgba(0,0,0,0.6)]">
        {tabs.map((t, idx) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          const badgeCount = pendingBadges[t.id] || 0;

          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
                isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
              )}
              <div className="relative">
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-indigo-500/15' : ''}`}>
                  <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110 text-indigo-400' : 'text-slate-400'}`} />
                </div>
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-sm shadow-rose-500/50">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-black text-white' : 'font-medium text-slate-400'}`}>
                {t.label}
              </span>
            </button>
          );
        })}

        {/* Mobile Quick Add Button */}
        {onQuickAdd && (
          <button
            onClick={onQuickAdd}
            aria-label="Adicionar lançamento rápido"
            className="flex items-center justify-center -mt-6 h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/40 border-2 border-[#0b0f19] active:scale-90 transition-transform cursor-pointer"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}
      </nav>
    </>
  );
}