'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FolderSearch, Plus, Clock, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { investigationsApi } from '@/lib/api';
import { cn, formatDate, getRiskColor } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

const statusIcons: Record<string, any> = {
  QUEUED: Clock,
  RUNNING: Loader2,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
  PARTIAL: AlertTriangle,
};

const statusColors: Record<string, string> = {
  QUEUED: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  RUNNING: 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30',
  COMPLETED: 'text-neon-green bg-neon-green/10 border-neon-green/30',
  FAILED: 'text-neon-red bg-neon-red/10 border-neon-red/30',
  PARTIAL: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchInvestigations = async () => {
      try {
        const { data } = await investigationsApi.list({ limit: 50 });
        setInvestigations(data.data || []);
      } catch {
        setInvestigations([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInvestigations();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <FolderSearch className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          Investigations
        </h1>
        <Link
          href="/dashboard/new-investigation"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}
        >
          <Plus className="w-4 h-4" /> New Investigation
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : investigations.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <FolderSearch className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
          <p className="mb-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>No investigations yet</p>
          <Link href="/dashboard/new-investigation" className="text-neon-cyan text-sm hover:underline">
            Start your first investigation →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {investigations.map((inv, i) => {
            const StatusIcon = statusIcons[inv.status] || Clock;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/dashboard/investigations/${inv.id}`}>
                  <div className="glass-panel rounded-xl p-5 hover:shadow-neon transition-all cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', statusColors[inv.status])}>
                          <StatusIcon className={cn('w-5 h-5', inv.status === 'RUNNING' && 'animate-spin')} />
                        </div>
                        <div>
                          <p className="text-sm font-medium transition-colors" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                            {inv.case?.caseNumber || 'N/A'}
                          </p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                            Wallet: {inv.suspectWallet?.substring(0, 10)}...
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        <div>
                          <span className={cn('px-2 py-1 rounded-full border text-[10px] font-medium', statusColors[inv.status])}>
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{inv.currentStage?.replace(/_/g, ' ')}</p>
                          <p style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{formatDate(inv.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {inv.status === 'RUNNING' && (
                      <div className="mt-3">
                        <div className="h-1 rounded-full bg-midnight-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${inv.progress || 0}%` }}
                            className="h-full rounded-full bg-gradient-to-r from-neon-cyan/50 to-neon-cyan"
                          />
                        </div>
                        <p className="text-[10px] mt-1 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{inv.progress || 0}%</p>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
