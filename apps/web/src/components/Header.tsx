'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, ChevronDown, LogOut, User, Settings, X } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { useUIStore } from '@/lib/stores/ui.store';
import { alertsApi, searchApi } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { timeAgo } from '@/lib/utils';
import { AlertDetailModal } from '@/components/AlertDetailModal';

// Shared alert store - singleton pattern via module scope
let _unreadCount = 0;
let _listeners: Set<() => void> = new Set();
const getUnreadCount = () => _unreadCount;
const subscribeUnreadCount = (cb: () => void) => { _listeners.add(cb); return () => { _listeners.delete(cb); }; };
const setUnreadCountGlobal = (n: number) => { _unreadCount = n; _listeners.forEach((l) => l()); };

export const useUnreadAlerts = () => {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const unsub = subscribeUnreadCount(() => forceUpdate((c) => c + 1));
    return unsub;
  }, []);
  return getUnreadCount();
};

/** Derive a readable display name from user data or email fallback */
function getDisplayName(user: any): string {
  if (user?.firstName || user?.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  if (user?.name) return user.name;
  if (user?.email) {
    const local = user.email.split('@')[0];
    // Convert "john.doe" → "John Doe", "johndoe" → "Johndoe"
    return local
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  return 'User';
}

/** Get initials from user data or email fallback */
function getInitials(user: any): string {
  if (user?.firstName?.[0] || user?.lastName?.[0]) {
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  }
  if (user?.name) {
    const parts = user.name.split(' ');
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : user.name.substring(0, 2).toUpperCase();
  }
  if (user?.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return 'U';
}

function formatRole(role: string | undefined): string {
  if (!role) return 'Analyst';
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export const Header = memo(function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const isDemoMode = useUIStore(s => s.isDemoMode);
  const toggleDemoMode = useUIStore(s => s.toggleDemoMode);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const unreadCount = useUnreadAlerts();

  const isDark = theme === 'dark';
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  useEffect(() => {
    let mounted = true;
    const fetchAlerts = async () => {
      try {
        const { data } = await alertsApi.getUnreadCount();
        if (mounted) setUnreadCountGlobal(data.data?.count ?? data.count ?? 0);
      } catch { /* ignore */ }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    setNotifLoading(true);
    alertsApi.list({ limit: 20 })
      .then(({ data }) => setNotifications(data.data || data || []))
      .catch(() => setNotifications([]))
      .finally(() => setNotifLoading(false));
  }, [showNotifications]);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const { data } = await searchApi.search(searchQuery);
        setSearchResults(data.data || []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setShowNotifications(false);
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const handleLogout = useCallback(async () => {
    setShowUserMenu(false);
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const markAllRead = useCallback(async () => {
    try {
      const unread = notifications.filter((n: any) => n.status === 'UNREAD');
      await Promise.all(unread.map((n: any) => alertsApi.markRead(n.id)));
      setNotifications((prev) => prev.map((n: any) => ({ ...n, status: 'READ' })));
      setUnreadCountGlobal(0);
    } catch { /* ignore */ }
  }, [notifications]);

  const handleNotifClick = useCallback(async (notif: any) => {
    setSelectedAlert(notif);
    if (notif.status === 'UNREAD') {
      try { await alertsApi.markRead(notif.id); } catch { /* ignore */ }
      setNotifications((prev) => prev.map((n: any) => n.id === notif.id ? { ...n, status: 'READ' } : n));
      setUnreadCountGlobal(Math.max(0, getUnreadCount() - 1));
    }
    setShowNotifications(false);
  }, []);

  const notifTypeIcon = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: '#ef4444',
      HIGH:     '#f97316',
      MEDIUM:   '#eab308',
      LOW:      '#3b82f6',
    };
    const color = colors[severity] || '#64748b';
    return (
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0, marginTop: 4,
      }} />
    );
  };

  return (
    <header
      className="h-16 border-b backdrop-blur-xl flex items-center justify-between px-6 relative z-50"
      style={{
        borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(0, 0, 0, 0.06)',
        background: isDark ? 'rgba(10, 12, 20, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-lg" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search wallets, cases, VASPs..."
            className="w-full pl-10 pr-20 py-2 rounded-lg text-sm outline-none transition-all"
            style={{
              background: isDark ? 'rgba(26, 30, 47, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              border: `1px solid ${isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(0, 0, 0, 0.06)'}`,
              color: isDark ? '#ffffff' : '#101318',
            }}
          />
          <kbd
            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-mono rounded"
            style={{
              color: isDark ? '#64748b' : '#94a3b8',
              background: isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              border: `1px solid ${isDark ? 'rgba(58, 66, 101, 0.5)' : 'rgba(0, 0, 0, 0.06)'}`,
            }}
          >
            Ctrl K
          </kbd>
        </div>
        <AnimatePresence>
          {showSearch && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl shadow-glass overflow-hidden max-h-80 overflow-y-auto"
              style={{ zIndex: 70 }}
            >
              {searchResults.map((result: any, i: number) => (
                <button
                  key={i}
                  onClick={() => { router.push(result.url); setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                  style={{ color: isDark ? '#cbd5e1' : '#475569' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 150, 180, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono"
                    style={{
                      background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)',
                      color: isDark ? '#00f0ff' : '#0891b2',
                    }}
                  >
                    {result.type?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: isDark ? '#ffffff' : '#101318' }}>{result.title}</p>
                    <p className="text-xs truncate" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{result.subtitle}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
          {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl shadow-glass p-4 text-center"
              style={{ zIndex: 70 }}
            >
              <p className="text-sm" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>No results found</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-6">
        <button 
          onClick={() => toggleDemoMode()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${isDemoMode ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white'}`}
          title="Toggle Mock/Demo Data Fallback"
        >
          {isDemoMode ? 'DEMO DATA ON' : 'REAL DATA ONLY'}
        </button>
        <ThemeToggle size="sm" />

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: isDark ? '#94a3b8' : '#64748b' }}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-neon-red text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.98 }}
                className="absolute right-0 top-full mt-2 w-80 glass-panel rounded-xl shadow-glass overflow-hidden"
                style={{ zIndex: 70 }}
              >
                <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <p className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifLoading ? (
                    <div className="p-4 text-center">
                      <div
                        className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
                        style={{
                          borderColor: isDark ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 150, 180, 0.3)',
                          borderTopColor: isDark ? '#00f0ff' : '#0891b2',
                        }}
                      />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: isDark ? '#475569' : '#94a3b8' }} />
                      <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 15).map((notif: any) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className="w-full text-left px-4 py-3 border-b transition-colors"
                        style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(0, 240, 255, 0.03)' : 'rgba(0, 150, 180, 0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs mt-0.5">{notifTypeIcon(notif.severity)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate" style={{ color: isDark ? '#ffffff' : '#101318' }}>{notif.title}</p>
                            <p className="text-[11px] truncate mt-0.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{notif.message}</p>
                            <p className="text-[10px] mt-1 font-mono" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{notif.createdAt ? timeAgo(notif.createdAt) : ''}</p>
                          </div>
                          {notif.status === 'UNREAD' && <div className="w-2 h-2 rounded-full bg-neon-cyan flex-shrink-0 mt-1" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                    <button
                      onClick={() => { setShowNotifications(false); router.push('/dashboard/alerts'); }}
                      className="w-full text-center text-[11px] font-medium py-1 rounded transition-colors"
                      style={{ color: isDark ? '#00f0ff' : '#0891b2' }}
                    >
                      View all alerts
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: isDark ? '#94a3b8' : '#64748b' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)',
                border: isDark ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(0, 150, 180, 0.2)',
              }}
            >
              <span className="text-xs font-bold" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                {initials}
              </span>
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium leading-tight" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                {displayName}
              </p>
              <p className="text-[11px] leading-tight" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                {formatRole(user?.role)}
              </p>
            </div>
            <ChevronDown className="w-3 h-3" style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
          </button>
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.98 }}
                className="absolute right-0 top-full mt-2 w-56 glass-panel rounded-xl shadow-glass overflow-hidden"
                style={{ zIndex: 70 }}
              >
                <div className="p-3 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{displayName}</p>
                  <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{user?.email}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: isDark ? '#475569' : '#94a3b8' }}>{formatRole(user?.role)}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setShowUserMenu(false); router.push('/dashboard/settings'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                    style={{ color: isDark ? '#cbd5e1' : '#475569' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 150, 180, 0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User className="w-4 h-4" /> My Profile
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); router.push('/dashboard/settings'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                    style={{ color: isDark ? '#cbd5e1' : '#475569' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 150, 180, 0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Settings className="w-4 h-4" /> Account Settings
                  </button>
                  <div className="my-1 border-t" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }} />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
                    style={{ color: '#ef4444' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Notification Detail Modal */}
      <AlertDetailModal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        alert={selectedAlert}
        onMarkRead={(id) => {
          setNotifications((prev) => prev.map((n: any) => n.id === id ? { ...n, status: 'READ' } : n));
          setUnreadCountGlobal(Math.max(0, getUnreadCount() - 1));
        }}
      />
    </header>
  );
});
