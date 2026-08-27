'use client';

import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem('chainsentinel-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('chainsentinel-theme', theme);
  } catch {}
}

export const useThemeStore = create<ThemeState>((set) => ({
  // Initialize from localStorage only (ThemeInit script already set the DOM)
  theme: getInitialTheme(),
  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { theme: next };
    });
  },
}));

// NOTE: Do NOT apply theme to DOM here at module scope.
// ThemeInit script in layout.tsx handles initial DOM theme before React hydration.
// This avoids race conditions between ThemeInit and Zustand store initialization.
