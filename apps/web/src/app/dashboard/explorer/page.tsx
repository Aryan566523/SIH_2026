'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Wallet, FileText, MapPin, Network } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { searchApi } from '@/lib/api';
import { useThemeStore } from '@/lib/stores/theme.store';

export default function ExplorerPage() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const { data } = await searchApi.search(query);
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const typeIcons: Record<string, any> = {
    wallet: Wallet,
    case: FileText,
    vasp: MapPin,
    transaction: Network,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <Search className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Blockchain Explorer
      </h1>

      <div className="glass-panel rounded-xl p-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Search across wallets, transactions, cases, VASPs, and entities</p>
          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter wallet address, TX hash, case number, or entity name..."
              className="flex-1 px-4 py-3 rounded-lg text-sm font-mono outline-none"
              style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query}
              className="px-6 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}
            >
              {loading ? <div className="w-5 h-5 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" /> : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, i) => {
            const Icon = typeIcons[result.type] || Search;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(result.url)}
                className="glass-panel rounded-xl p-4 flex items-center gap-4 hover:shadow-neon transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)', border: isDark ? '1px solid rgba(0, 240, 255, 0.2)' : '1px solid rgba(0, 150, 180, 0.15)' }}>
                  <Icon className="w-5 h-5" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{result.title}</p>
                  <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{result.subtitle}</p>
                </div>
                <span className="ml-auto text-[10px] font-mono uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{result.type}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
