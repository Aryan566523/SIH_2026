'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { healthApi } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

const serviceLabels: Record<string, string> = {
  api: 'API Gateway',
  postgres: 'PostgreSQL',
  neo4j: 'Neo4j Graph DB',
  redis: 'Redis Cache',
  ethProvider: 'ETH Provider',
  tronProvider: 'TRON Provider',
  workerQueue: 'Worker Queue',
  realtimeGateway: 'WebSocket',
};

const statusConfig: Record<string, { icon: any; color: string }> = {
  HEALTHY: { icon: CheckCircle, color: 'text-neon-green bg-neon-green/10 border-neon-green/30' },
  DEGRADED: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  DOWN: { icon: XCircle, color: 'text-neon-red bg-neon-red/10 border-neon-red/30' },
};

export default function HealthPage() {
  const [health, setHealth] = useState<Record<string, any>>({});
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const [detailedRes, providersRes] = await Promise.allSettled([
          healthApi.check(),
          healthApi.getProviders()
        ]);
        
        if (detailedRes.status === 'fulfilled') {
          setHealth(detailedRes.value.data.services || {});
        }
        if (providersRes.status === 'fulfilled') {
          setProviders(providersRes.value.data.providers || {});
        }
      } catch {
        setHealth({});
        setProviders({});
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Activity className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          System Health
        </h1>
        <div className="flex items-center gap-2 text-xs font-mono" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          Auto-refresh: 15s
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(health).map(([key, status]: [string, any], i) => {
              const config = statusConfig[status.status] || statusConfig.HEALTHY;
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel rounded-xl p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{serviceLabels[key] || key}</p>
                      <p className="text-lg font-bold mt-1" style={{ color: isDark ? '#ffffff' : '#101318' }}>{status.status}</p>
                    </div>
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', config.color)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                  </div>
                  {status.latency !== null && (
                    <p className="text-[10px] mt-2 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Latency: {status.latency}ms</p>
                  )}
                  <p className="text-[10px] mt-1 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Checked: {formatDateTime(status.lastChecked)}</p>
                </motion.div>
              );
            })}
          </div>

          <h2 className="text-lg font-bold mt-8 mb-4" style={{ color: isDark ? '#ffffff' : '#101318' }}>Blockchain Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(providers).map(([key, status]: [string, any], i) => {
              const config = statusConfig[status.status] || statusConfig.HEALTHY;
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="glass-panel rounded-xl p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{serviceLabels[key] || key}</p>
                      <p className="text-lg font-bold mt-1" style={{ color: isDark ? '#ffffff' : '#101318' }}>{status.status}</p>
                    </div>
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', config.color)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                  </div>
                  {status.latency !== null && (
                    <p className="text-[10px] mt-2 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Latency: {status.latency}ms</p>
                  )}
                  <p className="text-[10px] mt-1 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Checked: {formatDateTime(status.lastChecked)}</p>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
