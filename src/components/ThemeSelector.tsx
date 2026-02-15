import React, { useState } from 'react';
import { useThemeStore, themes, ThemeId } from '../store/themeStore';
import { Palette } from 'lucide-react';
import clsx from 'clsx';

export const ThemeSelector = () => {
  const { currentTheme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (id: ThemeId) => {
    setTheme(id);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/40 text-white/80 hover:text-white p-2 rounded-full transition-all hover:bg-black/60"
        title="更换主题"
      >
        <Palette size={20} />
      </button>

      {isOpen && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 border border-slate-100">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    选择桌布
                </div>
                {Object.values(themes).map(theme => (
                    <button
                        key={theme.id}
                        onClick={() => handleSelect(theme.id)}
                        className={clsx(
                            "w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0",
                            currentTheme === theme.id ? "bg-blue-50/50 text-blue-600 font-bold" : "text-slate-600"
                        )}
                    >
                        <div 
                            className={clsx("w-5 h-5 rounded-full shadow-sm border border-black/10", theme.backgroundClass)} 
                        ></div>
                        <span>{theme.name}</span>
                    </button>
                ))}
            </div>
        </>
      )}
    </div>
  );
};
