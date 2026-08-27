'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search, ExternalLink } from 'lucide-react';
import { vaspApi } from '@/lib/api';
import { cn, shortenAddress } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

const typeColors: Record<string, string> = {
  centralized_exchange: 'bg-neon-green/10 text-neon-green border-neon-green/30',
  decentralized_exchange: 'bg-neon-violet/10 text-neon-violet border-neon-violet/30',
  bridge: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30',
  mixer: 'bg-neon-red/10 text-neon-red border-neon-red/30',
  payment_service: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  gambling: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
};

export default function VaspPage() {
  const [vasps, setVasps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchVasps = async () => {
      try {
        const { data } = await vaspApi.list({ limit: 50 });
        setVasps(data.data || []);
      } catch {
        setVasps([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVasps();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <MapPin className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        VASP Intelligence
      </h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vasps.map((vasp, i) => (
            <motion.div
              key={vasp.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-xl p-5 hover:shadow-neon transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{vasp.name}</h3>
                  <span className={cn('inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', typeColors[vasp.type] || typeColors.centralized_exchange)}>
                    {vasp.type?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-neon-green">{vasp.confidence}%</p>
                  <p className="text-[10px] text-slate-500">confidence</p>
                </div>
              </div>
              <div className="space-y-1 text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                <p>Jurisdiction: {vasp.jurisdiction || 'Unknown'}</p>
                <p>Wallets: {vasp.wallets?.length || 0} known</p>
                <p>Chains: {vasp.chains?.join(', ')}</p>
                <p>Source: {vasp.source}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
