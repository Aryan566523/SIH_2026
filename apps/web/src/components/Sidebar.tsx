'use client';

import { memo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FolderSearch, Plus, Network, MapPin,
  Eye, FileWarning, Link2, Bell, List, FileText, Search,
  Activity, Settings, Users, ChevronLeft, ChevronRight, Shield, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { useUnreadAlerts } from '@/components/Header';
import { UserRole } from '@chainsentinel/types';

interface NavItem {
  label: string;
  href: string;
  icon: any;
  badge?: number;
  group?: string;
  roles?: UserRole[];
}

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.AGENCY_ADMIN];

const NAV_ITEMS: NavItem[] = [
  { label: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Investigations', href: '/dashboard/investigations', icon: FolderSearch },
  { label: 'New Investigation', href: '/dashboard/new-investigation', icon: Plus },
  { label: 'Blockchain Explorer', href: '/dashboard/explorer', icon: Search, group: 'Intelligence' },
  { label: 'Transaction Graph', href: '/dashboard/graph', icon: Network },
  { label: 'VASP Intelligence', href: '/dashboard/vasp', icon: MapPin },
  { label: 'Wallet Intelligence', href: '/dashboard/wallets', icon: Eye },
  { label: 'Fraud Campaigns', href: '/dashboard/campaigns', icon: FileWarning },
  { label: 'Cross-Chain Monitor', href: '/dashboard/cross-chain', icon: Link2 },
  { label: 'Alerts', href: '/dashboard/alerts', icon: Bell, badge: 0, group: 'Operations' },
  { label: 'Watchlist', href: '/dashboard/watchlist', icon: List },
  { label: 'Reports', href: '/dashboard/reports', icon: FileText },
  { label: 'System Health', href: '/dashboard/health', icon: Activity, group: 'System' },
  { label: 'Administration', href: '/dashboard/admin', icon: Users, roles: ADMIN_ROLES },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Glossary', href: '/dashboard/glossary', icon: BookOpen },
];

/** Derive a readable display name from user data or email fallback */
function getDisplayName(user: any): string {
  if (user?.firstName || user?.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  if (user?.name) return user.name;
  if (user?.email) {
    const local = user.email.split('@')[0];
    return local
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  return 'User';
}

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
  if (user?.email) return user.email.substring(0, 2).toUpperCase();
  return 'U';
}

const SidebarComponent = memo(function Sidebar() {
  const pathname = usePathname();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const unreadAlerts = useUnreadAlerts();

  const isDark = theme === 'dark';
  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles || !user?.role) return true;
    return item.roles.includes(user.role as UserRole);
  });

  const items = visibleItems.map((item) =>
    item.label === 'Alerts' ? { ...item, badge: unreadAlerts } : item
  );

  const groups = items.reduce((acc, item) => {
    const group = item.group || 'main';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const sidebarBg = isDark ? 'rgba(10, 12, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const borderColor = isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const textActiveColor = isDark ? '#00f0ff' : '#0891b2';

  return (
    <aside
      className="fixed left-0 top-0 h-full backdrop-blur-xl border-r z-40 flex flex-col overflow-hidden"
      style={{
        background: sidebarBg,
        borderColor,
        width: sidebarCollapsed ? 64 : 256,
        transition: 'width 0.3s ease-in-out',
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="block">
        <div className="flex items-center h-16 px-4 border-b cursor-pointer transition-colors" style={{ borderColor }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)',
                border: isDark ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(0, 150, 180, 0.2)',
              }}
            >
              <Shield className="w-4 h-4" style={{ color: textActiveColor }} />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold whitespace-nowrap" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                  Chain<span style={{ color: textActiveColor }}>Sentinel</span>
                </h1>
                <p className="text-[10px] font-mono tracking-widest whitespace-nowrap" style={{ color: textColor }}>
                  INTEL
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {Object.entries(groups).map(([group, groupItems], gi) => (
          <div key={group} className={gi > 0 ? 'mt-4' : ''}>
            {group !== 'main' && !sidebarCollapsed && (
              <p className="px-3 mb-1 text-[10px] font-mono tracking-widest uppercase" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                {group}
              </p>
            )}
            {groupItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} prefetch={true}>
                  <div
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 mb-0.5 cursor-pointer select-none',
                      sidebarCollapsed && 'justify-center px-0',
                    )}
                    style={{
                      background: isActive
                        ? (isDark ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 150, 180, 0.06)')
                        : 'transparent',
                      borderLeft: isActive ? `2px solid ${textActiveColor}` : '2px solid transparent',
                      color: isActive ? textActiveColor : textColor,
                      boxShadow: isActive ? (isDark ? '0 0 10px rgba(0, 240, 255, 0.2)' : '0 0 8px rgba(0, 150, 180, 0.15)') : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = isDark ? 'rgba(0, 240, 255, 0.03)' : 'rgba(0, 150, 180, 0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                    {item.badge && item.badge > 0 && (
                      <span
                        className={cn(
                          'absolute right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold',
                          'bg-neon-red text-white',
                          sidebarCollapsed && 'right-[-4px] top-[-4px] min-w-[14px] h-[14px]',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User section at bottom */}
      {!sidebarCollapsed && user && (
        <div className="px-3 py-3 border-t" style={{ borderColor }}>
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)',
                border: isDark ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(0, 150, 180, 0.2)',
              }}
            >
              <span className="text-xs font-bold" style={{ color: textActiveColor }}>
                {initials}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: isDark ? '#e2e8f0' : '#334155' }}>
                {displayName}
              </p>
              <p className="text-[10px] truncate" style={{ color: textColor }}>
                {user.role ? user.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Analyst'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t transition-colors"
        style={{
          borderColor,
          color: textColor,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 150, 180, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
});

export { SidebarComponent as Sidebar };

