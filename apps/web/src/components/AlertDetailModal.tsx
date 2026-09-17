'use client';

import React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  Wallet,
  FileText,
  Search,
  Copy,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { cn, getSeverityColor, formatDateTime, timeAgo } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';

interface AlertDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: any | null;
  onMarkRead?: (id: string) => void;
}

const severityIcons: Record<string, any> = {
  CRITICAL: AlertTriangle,
  HIGH: AlertCircle,
  MEDIUM: AlertCircle,
  LOW: Info,
  INFO: Info,
};

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  isOpen,
  onClose,
  alert,
  onMarkRead,
}) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  if (!isOpen || !alert) return null;

  const Icon = severityIcons[alert.severity] || Info;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const walletAddr = alert.walletAddress || alert.metadata?.walletAddress || alert.metadata?.address;
  const caseId = alert.caseId || alert.case?.id || alert.metadata?.caseId;
  const caseTitle = alert.case?.title || alert.case?.caseNumber || alert.metadata?.caseTitle;
  const investigationId = alert.investigationId || alert.metadata?.investigationId;
  const txHash = alert.metadata?.txHash || alert.txHash;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden z-10"
          style={{
            background: isDark ? 'rgba(15, 18, 28, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            borderColor: isDark ? 'rgba(42, 48, 74, 0.8)' : 'rgba(226, 232, 240, 0.9)',
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Header Bar */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(226, 232, 240, 0.8)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center border font-bold',
                  getSeverityColor(alert.severity)
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider',
                      getSeverityColor(alert.severity)
                    )}
                  >
                    {alert.severity || 'INFO'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: alert.status === 'UNREAD' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: alert.status === 'UNREAD' ? (isDark ? '#00f0ff' : '#0284c7') : '#64748b',
                    }}
                  >
                    {alert.status}
                  </span>
                  {alert.type && (
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded"
                      style={{
                        background: isDark ? 'rgba(30, 35, 55, 0.8)' : 'rgba(241, 245, 249, 0.8)',
                        color: isDark ? '#94a3b8' : '#64748b',
                      }}
                    >
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs mt-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateTime(alert.createdAt || new Date().toISOString())}</span>
                  <span>•</span>
                  <span>{timeAgo(alert.createdAt || new Date().toISOString())}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all hover:rotate-90 hover:scale-105"
              style={{
                color: isDark ? '#94a3b8' : '#64748b',
                background: isDark ? 'rgba(30, 35, 55, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-130px)]">
            {/* Title & Message */}
            <div className="space-y-2">
              <h2
                className="text-lg font-bold leading-tight"
                style={{ color: isDark ? '#ffffff' : '#0f172a' }}
              >
                {alert.title || 'Security Notification'}
              </h2>
              <div
                className="p-4 rounded-xl text-sm leading-relaxed border"
                style={{
                  background: isDark ? 'rgba(26, 30, 47, 0.4)' : 'rgba(248, 250, 252, 0.8)',
                  borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                  color: isDark ? '#e2e8f0' : '#334155',
                }}
              >
                {alert.message || 'No detailed message provided for this alert.'}
              </div>
            </div>

            {/* Entity Associations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Wallet Association */}
              {walletAddr && (
                <div
                  className="p-3.5 rounded-xl border flex flex-col justify-between gap-2"
                  style={{
                    background: isDark ? 'rgba(20, 24, 38, 0.6)' : 'rgba(248, 250, 252, 0.9)',
                    borderColor: isDark ? 'rgba(42, 48, 74, 0.6)' : 'rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                      Associated Wallet
                    </span>
                    <button
                      onClick={() => copyToClipboard(walletAddr, 'Wallet Address')}
                      className="p-1 rounded hover:bg-cyan-500/10 text-cyan-400 transition-colors"
                      title="Copy Address"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs font-mono break-all font-semibold" style={{ color: isDark ? '#00f0ff' : '#0284c7' }}>
                    {walletAddr}
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/dashboard/wallets/${walletAddr}`}
                      onClick={onClose}
                      className="text-xs font-medium flex items-center gap-1 hover:underline"
                      style={{ color: isDark ? '#00f0ff' : '#0284c7' }}
                    >
                      Wallet Profile <ExternalLink className="w-3 h-3" />
                    </Link>
                    <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>•</span>
                    <Link
                      href={`/dashboard/graph?address=${walletAddr}`}
                      onClick={onClose}
                      className="text-xs font-medium flex items-center gap-1 hover:underline"
                      style={{ color: isDark ? '#a855f7' : '#9333ea' }}
                    >
                      Inspect Graph <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Case Association */}
              {caseId && (
                <div
                  className="p-3.5 rounded-xl border flex flex-col justify-between gap-2"
                  style={{
                    background: isDark ? 'rgba(20, 24, 38, 0.6)' : 'rgba(248, 250, 252, 0.9)',
                    borderColor: isDark ? 'rgba(42, 48, 74, 0.6)' : 'rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Linked Case
                  </span>
                  <div>
                    <div className="text-sm font-semibold truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                      {caseTitle || `Case #${caseId.substring(0, 8)}`}
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                      ID: {caseId}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/cases/${caseId}`}
                    onClick={onClose}
                    className="text-xs font-medium flex items-center gap-1 hover:underline pt-1 text-amber-400"
                  >
                    Open Case Details <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Investigation Association */}
              {investigationId && (
                <div
                  className="p-3.5 rounded-xl border flex flex-col justify-between gap-2"
                  style={{
                    background: isDark ? 'rgba(20, 24, 38, 0.6)' : 'rgba(248, 250, 252, 0.9)',
                    borderColor: isDark ? 'rgba(42, 48, 74, 0.6)' : 'rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    <Search className="w-3.5 h-3.5 text-emerald-400" />
                    Investigation Job
                  </span>
                  <div>
                    <div className="text-sm font-semibold truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                      Investigation Artifact
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                      ID: {investigationId}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/investigations/${investigationId}`}
                    onClick={onClose}
                    className="text-xs font-medium flex items-center gap-1 hover:underline pt-1 text-emerald-400"
                  >
                    View Investigation Workspace <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Transaction Hash */}
              {txHash && (
                <div
                  className="p-3.5 rounded-xl border flex flex-col justify-between gap-2"
                  style={{
                    background: isDark ? 'rgba(20, 24, 38, 0.6)' : 'rgba(248, 250, 252, 0.9)',
                    borderColor: isDark ? 'rgba(42, 48, 74, 0.6)' : 'rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      Triggering Transaction
                    </span>
                    <button
                      onClick={() => copyToClipboard(txHash, 'Tx Hash')}
                      className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                      title="Copy Hash"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs font-mono break-all font-semibold" style={{ color: isDark ? '#f87171' : '#dc2626' }}>
                    {txHash}
                  </span>
                  <a
                    href={`https://eth.blockscout.com/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium flex items-center gap-1 hover:underline pt-1 text-red-400"
                  >
                    Blockscout Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Metadata Payload (Raw/Inspectable) */}
            {alert.metadata && Object.keys(alert.metadata).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  Technical Payload & Telemetry
                </span>
                <div
                  className="rounded-xl border p-3 font-mono text-xs overflow-x-auto max-h-48"
                  style={{
                    background: isDark ? 'rgba(10, 12, 20, 0.9)' : 'rgba(241, 245, 249, 0.95)',
                    borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(226, 232, 240, 0.9)',
                    color: isDark ? '#38bdf8' : '#0369a1',
                  }}
                >
                  <pre>{JSON.stringify(alert.metadata, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            className="flex items-center justify-between px-6 py-4 border-t"
            style={{
              borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : 'rgba(226, 232, 240, 0.8)',
              background: isDark ? 'rgba(20, 24, 38, 0.4)' : 'rgba(248, 250, 252, 0.6)',
            }}
          >
            {alert.status === 'UNREAD' && onMarkRead ? (
              <button
                onClick={() => {
                  onMarkRead(alert.id);
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.12)',
                  border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)',
                  color: isDark ? '#00f0ff' : '#0891b2',
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Resolved / Read
              </button>
            ) : (
              <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Alert is acknowledged
              </span>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: isDark ? 'rgba(30, 35, 55, 0.8)' : 'rgba(226, 232, 240, 0.8)',
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
