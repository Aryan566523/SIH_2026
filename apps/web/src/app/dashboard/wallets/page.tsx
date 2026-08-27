'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, Search, Shield, AlertTriangle } from 'lucide-react';
import { walletsApi } from '@/lib/api';
import { cn, shortenAddress, getRiskColor } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

export default function WalletsPage() {
  const [query, setQuery] = useState('');
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const { data } = await walletsApi.search(query);
      setWallets(data.data || []);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <Eye className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Wallet Intelligence
      </h1>

      <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by address, label, or entity..."
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm font-mono outline-none"
            style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : wallets.length > 0 ? (
        <div className="space-y-3">
          {wallets.map((wallet, i) => (
            <motion.div
              key={wallet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/dashboard/wallets/${wallet.address}`}>
                <div className="glass-panel rounded-xl p-4 flex items-center justify-between hover:shadow-neon transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', getRiskColor(wallet.riskLevel))}>
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-mono transition-colors" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                        {shortenAddress(wallet.address)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        {wallet.blockchain} {wallet.label && `• ${wallet.label}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold border', getRiskColor(wallet.riskLevel))}>
                      Risk: {wallet.riskScore || 0}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : query ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>No wallets found</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-12 text-center">
          <Eye className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
          <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Search for a wallet address to view intelligence</p>
        </div>
      )}
    </div>
  );
}
