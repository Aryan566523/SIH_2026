'use client';

import { Link2 } from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme.store';

export default function CrossChainPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <Link2 className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Cross-Chain Monitor
      </h1>
      <div className="glass-panel rounded-xl p-12 text-center">
        <Link2 className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
        <p className="mb-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Cross-chain bridge monitoring</p>
        <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
          Monitor cross-chain transfers detected during investigations.
          Bridge interactions and chain transitions will appear here.
        </p>
      </div>
    </div>
  );
}
