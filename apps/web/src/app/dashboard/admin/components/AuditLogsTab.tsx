'use client';

import { useState, useEffect } from 'react';
import { Search, Download, FileText } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';
import { adminApi } from '@/lib/api';

export function AuditLogsTab() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch for audit logs
    setTimeout(() => {
      setLogs([
        { id: 1, timestamp: new Date(Date.now() - 1000 * 60 * 5), actor: 'admin@sih.com', action: 'CREATE_INVESTIGATION', entity: 'Investigation #NCRP-2026-000483', ip: '192.168.1.1', status: 'SUCCESS' },
        { id: 2, timestamp: new Date(Date.now() - 1000 * 60 * 45), actor: 'admin@sih.com', action: 'UPDATE_BLOCKCHAIN_CONFIG', entity: 'Ethereum Mainnet', ip: '192.168.1.1', status: 'SUCCESS' },
        { id: 3, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), actor: 'system', action: 'API_FALLBACK_TRIGGERED', entity: 'TronGrid API', ip: 'internal', status: 'WARNING', details: 'Rate limit exceeded, falling back to mock provider.' },
        { id: 4, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), actor: 'superadmin', action: 'USER_LOGIN', entity: 'admin@sih.com', ip: '203.0.113.42', status: 'SUCCESS' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="pl-9 pr-4 py-2 text-sm rounded-lg bg-slate-900/50 border focus:border-neon-cyan outline-none w-64"
              style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0', color: isDark ? '#fff' : '#000' }}
            />
          </div>
          <select className="px-3 py-2 text-sm rounded-lg bg-slate-900/50 border outline-none text-slate-300" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
            <option value="">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="FALLBACK">System Fallback</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border hover:bg-slate-800 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0', color: isDark ? '#e2e8f0' : '#475569' }}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-900/20" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Actor</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">IP Address</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-slate-800/20 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">{formatDate(log.timestamp)}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{log.actor}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-neon-cyan border border-slate-700 font-bold">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{log.entity}
                      {log.details && <div className="text-[10px] text-amber-500 mt-1">{log.details}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.ip}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', 
                        log.status === 'SUCCESS' ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 
                        log.status === 'WARNING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 
                        'bg-red-500/10 text-red-400 border-red-500/30')}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
