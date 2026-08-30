'use client';

import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  isDemoMode: boolean;
  commandPaletteOpen: boolean;
  activeModal: string | null;
  toasts: Array<{ id: string; type: string; message: string }>;
  toggleSidebar: () => void;
  toggleDemoMode: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (type: string, message: string) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  isDemoMode: false,
  commandPaletteOpen: false,
  activeModal: null,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleDemoMode: () => set((s) => ({ isDemoMode: !s.isDemoMode })),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openModal: (id: string) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (type: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id: string) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

