'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Shield, Palette, Save } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { useUIStore } from '@/lib/stores/ui.store';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const { addToast } = useUIStore();
  const isDark = theme === 'dark';

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [notifPrefs, setNotifPrefs] = useState({
    criticalAlerts: true,
    investigationUpdates: true,
    watchlistTriggers: true,
    reportGeneration: false,
  });

  const handleSave = () => {
    addToast('success', 'Settings saved successfully');
  };

  const toggleNotif = (key: keyof typeof notifPrefs) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <SettingsIcon className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Settings
      </h1>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Shield className="w-4 h-4" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} /> Profile
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>First Name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Last Name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Email</label>
            <input value={user?.email || ''} disabled className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: isDark ? 'rgba(26,30,47,0.5)' : '#f8fafc', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#64748b' : '#94a3b8' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Role</label>
            <input value={user?.role?.replace(/_/g, ' ') || ''} disabled className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: isDark ? 'rgba(26,30,47,0.5)' : '#f8fafc', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#64748b' : '#94a3b8' }} />
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Bell className="w-4 h-4" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} /> Notifications
        </h3>
        <div className="space-y-3">
          {[
            { key: 'criticalAlerts' as const, label: 'Critical alerts', desc: 'Get notified for critical severity alerts' },
            { key: 'investigationUpdates' as const, label: 'Investigation updates', desc: 'Receive updates when investigations progress' },
            { key: 'watchlistTriggers' as const, label: 'Watchlist triggers', desc: 'Alert when watched wallets have activity' },
            { key: 'reportGeneration' as const, label: 'Report generation', desc: 'Notification when reports are ready' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm" style={{ color: isDark ? '#ffffff' : '#101318' }}>{item.label}</p>
                <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{item.desc}</p>
              </div>
              <button onClick={() => toggleNotif(item.key)} className="w-10 h-5 rounded-full flex items-center transition-all" style={{ background: notifPrefs[item.key] ? (isDark ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 150, 180, 0.3)') : (isDark ? '#2a304a' : '#e2e8f0'), border: `1px solid ${notifPrefs[item.key] ? (isDark ? 'rgba(0, 240, 255, 0.5)' : 'rgba(0, 150, 180, 0.4)') : (isDark ? '#3a4265' : '#cbd5e1')}` }}>
                <div className="w-4 h-4 rounded-full transition-all" style={{ background: notifPrefs[item.key] ? (isDark ? '#00f0ff' : '#0891b2') : (isDark ? '#64748b' : '#94a3b8'), transform: `translateX(${notifPrefs[item.key] ? '20px' : '2px'})` }} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Palette className="w-4 h-4" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} /> Appearance
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: isDark ? '#ffffff' : '#101318' }}>Theme</p>
            <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{isDark ? 'Dark mode (Cyber Black)' : 'Light mode (Intelligence White)'}</p>
          </div>
          <ThemeToggle size="md" />
        </div>
      </motion.div>

      {/* Save */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all" style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}>
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </motion.div>
    </div>
  );
}
