'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function RootPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c14' }}>
      <div className="text-center">
        <div className="relative w-12 h-12 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(0, 240, 255, 0.1)' }} />
          <div className="absolute inset-0 rounded-full border-2 animate-spin" style={{ borderColor: 'transparent', borderTopColor: '#00f0ff', animationDuration: '0.8s' }} />
        </div>
        <p className="text-xs font-mono tracking-wider" style={{ color: 'rgba(0, 240, 255, 0.5)' }}>LOADING</p>
      </div>
    </div>
  );
}
