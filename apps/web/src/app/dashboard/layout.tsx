'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { useUIStore } from '@/lib/stores/ui.store';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ToastContainer } from '@/components/ToastContainer';

/* ─── Top Progress Bar ─── */
function TopProgressBar({ show }: { show: boolean }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden pointer-events-none"
      style={{ opacity: show ? 1 : 0, transition: 'opacity 0.2s' }}
    >
      <div
        className="h-full animate-top-progress-bar"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent, #00f0ff, #8b5cf6, #00f0ff, transparent)'
            : 'linear-gradient(90deg, transparent, #0891b2, #6366f1, #0891b2, transparent)',
          width: '40%',
          animation: 'topProgressBar 1.5s ease-in-out infinite',
        }}
      />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const theme = useThemeStore((s) => s.theme);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const [authChecked, setAuthChecked] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isLoading) {
      setAuthChecked(true);
      if (!isAuthenticated) {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show top progress bar during initial auth check
  if (!authChecked || isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: isDark ? '#0a0c14' : '#f8fafc' }}
      >
        <TopProgressBar show />
        <div className="text-center">
          {/* Cyber-style loading spinner */}
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div
              className="absolute inset-0 rounded-full border-2 animate-spin"
              style={{
                borderColor: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.1)',
              }}
            />
            <div
              className="absolute inset-0 rounded-full border-2 animate-spin"
              style={{
                borderColor: 'transparent',
                borderTopColor: isDark ? '#00f0ff' : '#0891b2',
                animationDuration: '0.8s',
              }}
            />
            <div
              className="absolute inset-2 rounded-full animate-pulse"
              style={{
                background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)',
              }}
            />
          </div>
          <div className="flex items-center gap-1 justify-center">
            <span
              className="text-[10px] font-mono tracking-[0.2em]"
              style={{ color: isDark ? 'rgba(0, 240, 255, 0.5)' : 'rgba(8, 145, 178, 0.5)' }}
            >
              INITIALIZING SECURE SESSION
            </span>
            <span
              className="inline-block w-[2px] h-3 animate-blink"
              style={{ background: isDark ? '#00f0ff' : '#0891b2' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-grid bg-scan flex" style={{ background: isDark ? '#0a0c14' : '#f8fafc' }}>
      <Sidebar />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
