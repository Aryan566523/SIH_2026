'use client';

import { create } from 'zustand';
import { User } from '@chainsentinel/types';
import { authApi } from '../api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.login(email, password);
      const { tokens, user } = data;

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      document.cookie = `cs_access_token=${tokens.accessToken}; path=/; max-age=${tokens.expiresIn || 900}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.error?.message
        || error.response?.data?.message
        || 'Invalid email or password.';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Proceed with local cleanup
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      document.cookie = 'cs_access_token=; path=/; max-age=0; SameSite=Lax';
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  loadUser: async () => {
    // Skip if already loaded and authenticated
    const state = get();
    if (state.isAuthenticated && state.user) {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const { data } = await authApi.me();
      const userData = data.data || data;
      set({ user: userData, isAuthenticated: true, isLoading: false });
      document.cookie = `cs_access_token=${token}; path=/; max-age=900; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      document.cookie = 'cs_access_token=; path=/; max-age=0; SameSite=Lax';
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    document.cookie = 'cs_access_token=; path=/; max-age=0; SameSite=Lax';
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },
}));
