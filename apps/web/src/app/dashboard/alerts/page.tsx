'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, Eye, Shield } from 'lucide-react';
import { alertsApi } from '@/lib/api';
import { cn, getSeverityColor, formatDateTime, timeAgo } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';
import { AlertDetailModal } from '@/components/AlertDetailModal';

const severityIcons: Record<string, any> = {
  CRITICAL: AlertTriangle,
  HIGH: AlertCircle,
  MEDIUM: AlertCircle,
  LOW: Info,
  INFO: Info,
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const { data } = await alertsApi.list({ limit: 50 });
        setAlerts(data.data || []);
      } catch {
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await alertsApi.markRead(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'READ' } : a));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = alerts.filter((a) => a.status === 'UNREAD');
      await Promise.all(unread.map((a) => alertsApi.markRead(a.id)));
      setAlerts((prev) => prev.map((a) => ({ ...a, status: 'READ' })));
    } catch { /* ignore */ }
  };

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter((a) => a.severity === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Bell className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          Alert Center
        </h1>
        <div className="flex items-center gap-2">
          {alerts.some((a) => a.status === 'UNREAD') && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)',
                border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)',
                color: isDark ? '#00f0ff' : '#0891b2',
              }}
            >
              Mark all read
            </button>
          )}
          <div className="flex gap-1">
            {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all')}
                style={{
                  background: filter === f ? (isDark ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 150, 180, 0.15)') : 'transparent',
                  color: filter === f ? (isDark ? '#00f0ff' : '#0891b2') : (isDark ? '#94a3b8' : '#64748b'),
                  border: filter === f ? (isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)') : '1px solid transparent',
                }}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
          <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>No alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, i) => {
            const Icon = severityIcons[alert.severity] || Info;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'glass-panel rounded-xl p-4 flex items-start gap-4 cursor-pointer hover:shadow-neon transition-all',
                  alert.status === 'UNREAD' && 'border-l-4',
                  alert.severity === 'CRITICAL' && alert.status === 'UNREAD' && 'border-l-red-500',
                  alert.severity === 'HIGH' && alert.status === 'UNREAD' && 'border-l-orange-500',
                )}
                onClick={() => {
                  handleMarkRead(alert.id);
                  setSelectedAlert(alert);
                }}
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border', getSeverityColor(alert.severity))}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{alert.title}</h3>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', getSeverityColor(alert.severity))}>
                      {alert.severity}
                    </span>
                    {alert.status === 'UNREAD' && (
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: isDark ? '#00f0ff' : '#0891b2' }} />
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{alert.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                    {alert.walletAddress && (
                      <span className="font-mono">Wallet: {alert.walletAddress.substring(0, 12)}...</span>
                    )}
                    <span>{timeAgo(alert.createdAt)}</span>
                    {alert.type && <span className="uppercase">{alert.type.replace(/_/g, ' ')}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full Alert Details Modal */}
      <AlertDetailModal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        alert={selectedAlert}
        onMarkRead={(id) => handleMarkRead(id)}
      />
    </div>
  );
}
