'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  FolderSearch, AlertTriangle, Eye, MapPin, DollarSign, Link2,
  TrendingUp, Shield, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react';
import { casesApi, investigationsApi, alertsApi, watchlistApi, vaspApi, walletsApi } from '@/lib/api';
import { cn, formatNumber, formatAmount, timeAgo, getSeverityColor } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

interface MetricCardProps {
  label: string;
  value: number;
  icon: any;
  color: string;
  href: string;
  delay?: number;
  loading?: boolean;
}

function MetricCard({ label, value, icon: Icon, color, href, delay = 0, loading }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (loading) return;
    let start = 0;
    const duration = 800;
    const increment = Math.max(1, value / (duration / 16));
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) { setDisplayValue(value); clearInterval(timer); }
      else setDisplayValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, loading]);

  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className="glass-panel rounded-xl p-5 hover:shadow-neon transition-all duration-300 group cursor-pointer"
        style={{ borderColor: isDark ? undefined : 'rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono tracking-wider uppercase mb-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{label}</p>
            {loading ? (
              <div className="skeleton h-8 w-16 rounded" />
            ) : (
              <p className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{formatNumber(displayValue)}</p>
            )}
          </div>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:scale-110', color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

interface FeedItem {
  id: string;
  time: string;
  message: string;
  type: 'alert' | 'trace' | 'match' | 'info';
  href?: string;
}

const feedTypeColors: Record<string, string> = {
  alert: 'text-red-400',
  trace: 'text-cyan-400',
  match: 'text-green-400',
  info: 'text-blue-400',
};

export default function CommandCenter() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [stats, setStats] = useState({ cases: 0, investigations: 0, alerts: 0, wallets: 0, vasps: 0, watchlist: 0 });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<any[]>([]);
  const [chainData, setChainData] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [caseStats, invStats, alertStats, watchlist, vaspStats, alertList, walletSearch] = await Promise.allSettled([
        casesApi.getStats(),
        investigationsApi.getStats(),
        alertsApi.getStats(),
        watchlistApi.list({ limit: 1 }),
        vaspApi.getStats(),
        alertsApi.list({ limit: 10 }),
        walletsApi.search(''),
      ]);

      const cs = caseStats.status === 'fulfilled' ? caseStats.value.data.data : {};
      const is = invStats.status === 'fulfilled' ? invStats.value.data.data : {};
      const as = alertStats.status === 'fulfilled' ? alertStats.value.data.data : {};
      const wl = watchlist.status === 'fulfilled' ? watchlist.value.data : {};
      const vs = vaspStats.status === 'fulfilled' ? vaspStats.value.data.data : {};
      const alerts = alertList.status === 'fulfilled' ? (alertList.value.data.data || alertList.value.data || []) : [];
      const wallets = walletSearch.status === 'fulfilled' ? (walletSearch.value.data.data || []) : [];

      setStats({
        cases: cs.total || cs.totalCases || 0,
        investigations: is.total || is.totalInvestigations || 0,
        alerts: as.unread || as.total || 0,
        wallets: wallets.length,
        vasps: vs.total || 0,
        watchlist: wl.meta?.total || wl.total || 0,
      });

      // Build feed from real alerts
      const feedItems: FeedItem[] = alerts.map((a: any) => ({
        id: a.id,
        time: a.createdAt ? timeAgo(a.createdAt) : '',
        message: a.title || a.message || 'Alert',
        type: a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'alert' : a.type === 'vasp_match' ? 'match' : 'info' as any,
        href: '/dashboard/alerts',
      }));
      setFeed(feedItems);
      setRecentAlerts(alerts);

      // Build risk distribution from wallet search results
      const riskBuckets = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      wallets.forEach((w: any) => {
        const level = (w.riskLevel || 'LOW').toUpperCase();
        if (riskBuckets[level as keyof typeof riskBuckets] !== undefined) riskBuckets[level as keyof typeof riskBuckets]++;
        else riskBuckets.LOW++;
      });
      const total = Object.values(riskBuckets).reduce((a, b) => a + b, 0) || 1;
      setRiskData([
        { label: 'Critical', count: riskBuckets.CRITICAL, pct: Math.round((riskBuckets.CRITICAL / total) * 100), color: 'bg-red-500' },
        { label: 'High', count: riskBuckets.HIGH, pct: Math.round((riskBuckets.HIGH / total) * 100), color: 'bg-orange-500' },
        { label: 'Medium', count: riskBuckets.MEDIUM, pct: Math.round((riskBuckets.MEDIUM / total) * 100), color: 'bg-amber-400' },
        { label: 'Low', count: riskBuckets.LOW, pct: Math.round((riskBuckets.LOW / total) * 100), color: 'bg-green-500' },
      ]);

      // Blockchain distribution from wallets
      const chainCounts: Record<string, number> = {};
      wallets.forEach((w: any) => { const c = w.blockchain || 'UNKNOWN'; chainCounts[c] = (chainCounts[c] || 0) + 1; });
      const chainColors: Record<string, string> = { ETHEREUM: '#627EEA', BITCOIN: '#F7931A', TRON: '#FF0013', POLYGON: '#8247E5', BNB_CHAIN: '#F3BA2F', SOLANA: '#9945FF', UNKNOWN: '#64748b' };
      const sortedChains = Object.entries(chainCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
      const chainTotal = sortedChains.reduce((sum, [, c]) => sum + c, 0) || 1;
      setChainData(sortedChains.map(([name, count]) => ({
        name: name.replace(/_/g, ' '),
        count,
        pct: Math.round((count / chainTotal) * 100),
        color: chainColors[name] || '#64748b',
      })));

    } catch {
      // Use zeros
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const metrics = [
    { label: 'Active Investigations', value: stats.investigations, icon: FolderSearch, color: 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20', href: '/dashboard/investigations' },
    { label: 'Critical Alerts', value: stats.alerts, icon: AlertTriangle, color: 'bg-neon-red/10 text-neon-red border border-neon-red/20', href: '/dashboard/alerts' },
    { label: 'Suspect Wallets', value: stats.wallets, icon: Eye, color: 'bg-neon-violet/10 text-neon-violet border border-neon-violet/20', href: '/dashboard/wallets' },
    { label: 'VASP Matches', value: stats.vasps, icon: MapPin, color: 'bg-neon-green/10 text-neon-green border border-neon-green/20', href: '/dashboard/vasp' },
    { label: 'Watchlisted Wallets', value: stats.watchlist, icon: Shield, color: 'bg-pink-500/10 text-pink-400 border border-pink-500/20', href: '/dashboard/watchlist' },
    { label: 'Cases', value: stats.cases, icon: FolderSearch, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', href: '/dashboard/investigations' },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <Activity className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
            Command Center
          </h1>
          <p className="text-sm mt-1 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            Real-time blockchain intelligence overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          LIVE
        </div>
      </motion.div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} {...m} delay={i * 0.05} loading={loading} />
        ))}
      </div>

      {/* Charts and Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: isDark ? '#ffffff' : '#101318' }}>Risk Distribution</h3>
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-8 rounded" />)
            ) : riskData.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{r.label}</span>
                  <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{r.count} wallets</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: isDark ? '#1a1e2f' : '#e2e8f0' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ duration: 1, delay: 0.5 }} className={cn('h-full rounded-full', r.color)} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Blockchain Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: isDark ? '#ffffff' : '#101318' }}>Blockchain Activity</h3>
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="skeleton h-8 rounded" />)
            ) : chainData.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>No blockchain data yet</p>
            ) : chainData.map((b) => (
              <div key={b.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{b.name}</span>
                    <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{b.count} txs</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: isDark ? '#1a1e2f' : '#e2e8f0' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }} transition={{ duration: 1, delay: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: b.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Live Feed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            Live Investigation Feed
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {loading ? (
              [1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-6 rounded" />)
            ) : feed.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: isDark ? '#475569' : '#94a3b8' }} />
                <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>No recent activity</p>
              </div>
            ) : (
              feed.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className={cn('flex gap-3 text-xs cursor-pointer hover:opacity-80 transition-opacity')}
                  onClick={() => item.href && router.push(item.href)}
                >
                  <span className="font-mono w-20 flex-shrink-0" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{item.time}</span>
                  <span className={cn('flex-1', feedTypeColors[item.type])}>{item.message}</span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Recent Alerts</h3>
            <Link href="/dashboard/alerts" className="text-[11px] font-mono" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Severity</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Alert</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Wallet</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.slice(0, 5).map((alert: any) => (
                  <tr key={alert.id} className="border-b cursor-pointer hover:bg-midnight-800/30" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }} onClick={() => router.push('/dashboard/alerts')}>
                    <td className="px-3 py-2">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', getSeverityColor(alert.severity))}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>{alert.title}</td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{alert.walletAddress ? `${alert.walletAddress.substring(0, 8)}...` : '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{alert.createdAt ? timeAgo(alert.createdAt) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
