import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId = 'classic' | 'midnight' | 'wood' | 'minimal' | 'festive';

export interface Theme {
  id: ThemeId;
  name: string;
  backgroundClass: string; // Tailwind class for background
  accentColorClass: string; // Tailwind class for buttons/highlights
  textColorClass: string; // Tailwind class for text
  secondaryTextColorClass: string; // For subtitles/less important text
  cardBackStyle: 'blue' | 'red' | 'gray'; // Simple variant for card back
}

export const themes: Record<ThemeId, Theme> = {
  classic: {
    id: 'classic',
    name: '经典绿',
    backgroundClass: 'bg-green-800',
    accentColorClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    textColorClass: 'text-white',
    secondaryTextColorClass: 'text-white/80',
    cardBackStyle: 'blue'
  },
  midnight: {
    id: 'midnight',
    name: '午夜蓝',
    backgroundClass: 'bg-slate-900',
    accentColorClass: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    textColorClass: 'text-slate-100',
    secondaryTextColorClass: 'text-slate-400',
    cardBackStyle: 'gray'
  },
  wood: {
    id: 'wood',
    name: '暖木纹',
    backgroundClass: 'bg-[#5d4037]',
    accentColorClass: 'bg-orange-600 hover:bg-orange-700 text-white',
    textColorClass: 'text-amber-50',
    secondaryTextColorClass: 'text-amber-200/80',
    cardBackStyle: 'red'
  },
  minimal: {
    id: 'minimal',
    name: '极简灰',
    backgroundClass: 'bg-gray-200',
    accentColorClass: 'bg-gray-800 hover:bg-gray-900 text-white',
    textColorClass: 'text-gray-900',
    secondaryTextColorClass: 'text-gray-600',
    cardBackStyle: 'gray'
  },
  festive: {
    id: 'festive',
    name: '喜庆红',
    backgroundClass: 'bg-red-900',
    accentColorClass: 'bg-yellow-500 hover:bg-yellow-600 text-red-900',
    textColorClass: 'text-white',
    secondaryTextColorClass: 'text-red-100',
    cardBackStyle: 'red'
  }
};

interface ThemeState {
  currentTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
  getTheme: () => Theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      currentTheme: 'classic',
      setTheme: (id) => set({ currentTheme: id }),
      getTheme: () => themes[get().currentTheme]
    }),
    {
      name: 'wudi-theme-storage'
    }
  )
);
