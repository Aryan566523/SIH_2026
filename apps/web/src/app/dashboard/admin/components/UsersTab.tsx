'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

export function UsersTab() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('INVESTIGATOR');

    const handleInvite = async () => {
    try {
      await adminApi.inviteUser({ email, role });
      setInviteModalOpen(false);
      // Refresh
      const { data } = await adminApi.getUsers();
      setUsers(data.data || []);
    } catch {}
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await adminApi.updateRole(id, newRole);
      setEditingUser(null);
      const { data } = await adminApi.getUsers();
      setUsers(data.data || []);
    } catch {}
  };

  useEffect(() => {
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
  }, []);

  return (
    <div className="space-y-6">
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
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
          <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>User Accounts</h3>
          <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-colors">
            Invite User
          </button>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-900/20" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Name</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Email</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Role</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Status</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Created</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-slate-800/20 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
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
                    <td className="px-4 py-3">
                      <button onClick={() => setEditingUser(u)} className="text-xs text-neon-cyan hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
            {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 space-y-4">
            <h3 className="text-lg font-bold text-white">Invite User</h3>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white" />
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white">
              <option value="INVESTIGATOR">Investigator</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ADMIN">Admin</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setInviteModalOpen(false)} className="text-slate-400">Cancel</button>
              <button onClick={handleInvite} className="bg-neon-cyan text-black px-4 py-2 rounded font-bold">Invite</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 space-y-4">
            <h3 className="text-lg font-bold text-white">Edit {editingUser.email}</h3>
            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white">
              <option value="INVESTIGATOR">Investigator</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingUser(null)} className="text-slate-400">Cancel</button>
              <button onClick={() => handleUpdateRole(editingUser.id, editingUser.role)} className="bg-neon-cyan text-black px-4 py-2 rounded font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}


