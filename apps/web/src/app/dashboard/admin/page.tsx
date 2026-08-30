'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Lock, Database, Activity, Server, FileText } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { UserRole } from '@chainsentinel/types';

import { UsersTab } from './components/UsersTab';
import { OrganizationsTab } from './components/OrganizationsTab';
import { BlockchainProvidersTab } from './components/BlockchainProvidersTab';
import { AuditLogsTab } from './components/AuditLogsTab';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.AGENCY_ADMIN];

export default function AdminPage() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('users');
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role && !ADMIN_ROLES.includes(user.role as UserRole)) {
      setAccessDenied(true);
    }
    setLoading(false);
  }, [user?.role]);

  if (loading) {
    return <div className="p-8 text-center">Loading Administration...</div>;
  }

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

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'organizations', label: 'Organizations', icon: Shield },
    { id: 'providers', label: 'Blockchain Providers', icon: Database },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Server className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          System Administration
        </h1>
      </div>

      <div className="flex space-x-1 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2',
                isActive 
                  ? 'border-neon-cyan text-neon-cyan' 
                  : 'border-transparent hover:text-neon-cyan/70',
                !isActive && (isDark ? 'text-slate-400' : 'text-slate-600')
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'organizations' && <OrganizationsTab />}
            {activeTab === 'providers' && <BlockchainProvidersTab />}
            {activeTab === 'audit' && <AuditLogsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
