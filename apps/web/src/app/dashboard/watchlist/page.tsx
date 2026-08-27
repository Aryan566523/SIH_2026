'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { List, Plus, Trash2, Shield, Clock } from 'lucide-react';
import { watchlistApi } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';
import { cn, shortenAddress, timeAgo, getSeverityColor } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

export default function WatchlistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [newReason, setNewReason] = useState('');
  const { addToast } = useUIStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const { data } = await watchlistApi.list({ limit: 50 });
      setEntries(data.data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newWallet || !newReason) return;
    try {
      await watchlistApi.add({
        walletAddress: newWallet,
        blockchain: newWallet.startsWith('0x') ? 'ETHEREUM' : newWallet.startsWith('T') ? 'TRON' : 'BITCOIN',
        reason: newReason,
      });
      addToast('success', 'Wallet added to watchlist');
      setShowAdd(false);
      setNewWallet('');
      setNewReason('');
      fetchWatchlist();
    } catch {
      addToast('error', 'Failed to add to watchlist');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await watchlistApi.remove(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      addToast('success', 'Removed from watchlist');
    } catch {
      addToast('error', 'Failed to remove');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <List className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          Watchlist
        </h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}
        >
          <Plus className="w-4 h-4" /> Add Wallet
        </button>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4 space-y-3">
          <input
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Wallet address"
            className="w-full px-4 py-2 rounded-lg text-sm font-mono outline-none"
            style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
          />
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason for monitoring"
            className="w-full px-4 py-2 rounded-lg text-sm outline-none"
            style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}>Add</button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <List className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
          <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>No wallets on watchlist</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', getSeverityColor(entry.sensitivity))}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-mono" style={{ color: isDark ? '#ffffff' : '#101318' }}>{shortenAddress(entry.walletAddress)}</p>
                  <p className="text-xs mt-0.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{entry.reason}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{entry.blockchain} • {timeAgo(entry.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => handleRemove(entry.id)} className="p-2 transition-colors" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
