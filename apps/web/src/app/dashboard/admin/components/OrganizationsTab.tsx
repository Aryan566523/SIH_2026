'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

export function OrganizationsTab() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await adminApi.getOrganizations();
        setOrgs(res.data.data || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Organizations table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
          <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Organizations</h3>
          <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-colors">
            Add Organization
          </button>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-900/20" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Name</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Code</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Status</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Created</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-slate-800/20 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-3 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                      <Shield className="w-4 h-4 text-neon-violet" />
                      {o.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{o.code}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', o.isActive ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-red-500/10 text-red-400 border-red-500/30')}>
                        {o.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-neon-cyan hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No organizations found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
