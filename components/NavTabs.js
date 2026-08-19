'use client';

export default function NavTabs({ tabs, active, onChange }) {
  return (
    <>
      <nav className="hidden md:flex items-center gap-1.5 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] flex">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}