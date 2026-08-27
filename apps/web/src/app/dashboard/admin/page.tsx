'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Lock } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { UserRole } from '@chainsentinel/types';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.AGENCY_ADMIN];

export default function AdminPage() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (user?.role && !ADMIN_ROLES.includes(user.role as UserRole)) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [usersRes, statsRes] = await Promise.allSettled([
          adminApi.getUsers(),
          adminApi.getStats(),
        ]);
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data.data || []);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data || {});
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user?.role]);

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <Lock className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>Access Denied</h2>
        <p className="text-sm max-w-md" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
          You do not have permission to access the Administration panel. This section requires Administrator privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <Users className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Administration
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Users', value: stats.userCount || users.length || 0, icon: Users, color: 'text-neon-cyan' },
          { label: 'Organizations', value: stats.orgCount || 0, icon: Shield, color: 'text-neon-violet' },
          { label: 'Active Users', value: users.filter((u) => u.isActive).length, icon: Users, color: 'text-neon-green' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-panel rounded-xl p-4 text-center">
            <s.icon className={cn('w-5 h-5 mx-auto mb-1', s.color)} />
            <p className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{loading ? '-' : s.value}</p>
            <p className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Users table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
          <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Users</h3>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Name</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Email</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Role</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Status</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-3" style={{ color: isDark ? '#ffffff' : '#101318' }}>{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)', color: isDark ? '#00f0ff' : '#0891b2', borderColor: isDark ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 150, 180, 0.2)' }}>
                        {u.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', u.isActive ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-red-500/10 text-red-400 border-red-500/30')}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{formatDate(u.createdAt)}</td>
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
