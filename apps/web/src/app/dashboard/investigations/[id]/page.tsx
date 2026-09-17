'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Loader2, Circle, AlertTriangle, Clock,
  Wallet, Network, MapPin, Shield, FileText, ArrowRight,
  ExternalLink, ArrowUpRight, GitFork, Cpu, Layers, History,
  Copy, Check, GitBranch, ArrowDownRight
} from 'lucide-react';
import { investigationsApi } from '@/lib/api';
import { cn, formatDate, formatDateTime, getRiskColor, shortenAddress, formatAmount } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';
import { useUIStore } from '@/lib/stores/ui.store';

const STAGE_LABELS: Record<string, string> = {
  INVESTIGATION_REQUESTED: 'Investigation requested',
  ADDRESS_VALIDATION: 'Validating wallet address',
  CHAIN_DETECTION: 'Detecting blockchain',
  TRANSACTION_INGESTION: 'Loading transactions',
  TRANSACTION_NORMALIZATION: 'Normalizing data',
  GRAPH_BUILD: 'Building transaction graph',
  FUND_FLOW_TRACE: 'Tracing fund flow',
  ENTITY_MATCHING: 'Matching entities',
  CROSS_CHAIN_ANALYSIS: 'Cross-chain analysis',
  PATTERN_ANALYSIS: 'Analyzing fraud patterns',
  RISK_SCORING: 'Calculating risk score',
  VASP_ATTRIBUTION: 'Identifying VASP',
  CASE_CORRELATION: 'Searching related cases',
  RECOMMENDATION_GENERATION: 'Generating recommendations',
  INVESTIGATION_COMPLETED: 'Investigation completed',
};

const STAGES_ORDER = Object.keys(STAGE_LABELS);

export default function InvestigationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [investigation, setInvestigation] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hops' | 'branches' | 'timeline' | 'bridges' | 'miners' | 'pipeline'>('overview');
  const [copied, setCopied] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { addToast } = useUIStore();
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingNotice, setGeneratingNotice] = useState(false);
  const [visibleHopsCount, setVisibleHopsCount] = useState(20);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await investigationsApi.resume(id);
      addToast('Investigation re-queued and pipeline restarted', 'success' as any);
      const invRes = await investigationsApi.get(id);
      setInvestigation(invRes.data.data);
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Failed to retry investigation', 'error' as any);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await investigationsApi.generateReportPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Forensic_Report_${id.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('success', 'Forensic PDF report downloaded successfully');
    } catch (e) {
      console.error(e);
      addToast('error', 'Failed to download forensic report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateNotice = async () => {
    setGeneratingNotice(true);
    try {
      const response = await investigationsApi.generateNotice(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Section_91_CrPC_Notice_${id.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('success', 'Section 91 CrPC Notice PDF downloaded');
    } catch (e) {
      console.error(e);
      addToast('error', 'Failed to generate Section 91 notice');
    } finally {
      setGeneratingNotice(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, jobsRes] = await Promise.all([
          investigationsApi.get(id),
          investigationsApi.getJobs(id),
        ]);
        setInvestigation(invRes.data.data);
        setJobs(jobsRes.data.data || []);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Poll for updates if running
    const interval = setInterval(() => {
      if (investigation?.status === 'RUNNING' || investigation?.status === 'QUEUED') {
        fetchData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, investigation?.status]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="glass-panel rounded-xl p-12 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
        <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Investigation not found</p>
      </div>
    );
  }

  const isRunning = investigation.status === 'RUNNING' || investigation.status === 'QUEUED';
  const completedStages = jobs.filter((j) => j.status === 'COMPLETED').map((j) => j.stage);
  const currentStageIndex = STAGES_ORDER.indexOf(investigation.currentStage);

  const copyToClipboard = (text: string, label: string = 'Address') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addToast('success', `${label} copied to clipboard`);
  };

  const copySuspect = () => {
    if (investigation?.suspectWallet) {
      navigator.clipboard.writeText(investigation.suspectWallet);
      setCopied(true);
      addToast('success', 'Wallet address copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stats = investigation.stats || {};
  const hops = stats.hops || [];
  const timeline = stats.timeline || [];
  const bridges = stats.bridges || [];
  const miners = stats.miners || [];

  // Group hops into branches by sender wallet (branch source)
  const branches = (() => {
    const map = new Map<string, { sender: string; totalTransferred: number; token: string; targets: any[]; txCount: number }>();
    hops.forEach((h: any) => {
      const from = (h.from || '').toLowerCase();
      if (!from) return;
      if (!map.has(from)) {
        map.set(from, {
          sender: h.from,
          totalTransferred: 0,
          token: h.token || 'ETH',
          targets: [],
          txCount: 0,
        });
      }
      const entry = map.get(from)!;
      const amt = parseFloat(h.amount) || 0;
      entry.totalTransferred += amt;
      entry.txCount += 1;
      entry.targets.push({
        to: h.to,
        amount: h.amount,
        token: h.token || 'ETH',
        status: h.status || 'CONFIRMED',
        txHash: h.txHash,
        timestamp: h.timestamp,
        miner: h.miner,
        hopIndex: h.hopIndex,
      });
    });
    return Array.from(map.values());
  })();

    return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-xl p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-xl font-bold font-mono" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                {investigation.case?.caseNumber || 'Investigation'}
              </h1>
              <span className={cn(
                'px-3 py-1 rounded-full text-xs font-bold border',
                investigation.status === 'RUNNING' ? 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30 animate-pulse' :
                investigation.status === 'COMPLETED' ? 'text-neon-green bg-neon-green/10 border-neon-green/30' :
                investigation.status === 'FAILED' ? 'text-neon-red bg-neon-red/10 border-neon-red/30' :
                'text-slate-400 bg-slate-500/10 border-slate-500/30',
              )}>
                {isRunning && '⟳ '}{investigation.status}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Suspect:</span>
              <span className="font-mono font-medium" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                {investigation.suspectWallet}
              </span>
              <button onClick={copySuspect} className="p-1 hover:opacity-80 transition-opacity" title="Copy Address">
                {copied ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }} />}
              </button>
              {investigation.blockchain && (
                <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: '1px solid rgba(42, 48, 74, 0.5)', color: isDark ? '#94a3b8' : '#64748b' }}>
                  {investigation.blockchain}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-auto">
            {/* Quick Action Buttons */}
            <Link
              href={`/dashboard/graph?address=${encodeURIComponent(investigation.suspectWallet)}`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)',
                border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)',
                color: isDark ? '#00f0ff' : '#0891b2'
              }}
            >
              <Network className="w-4 h-4" /> Open Visual Graph
            </Link>

            <Link
              href={`/dashboard/wallets/${encodeURIComponent(investigation.suspectWallet)}`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isDark ? 'rgba(167, 139, 250, 0.15)' : 'rgba(124, 58, 237, 0.1)',
                border: isDark ? '1px solid rgba(167, 139, 250, 0.4)' : '1px solid rgba(124, 58, 237, 0.3)',
                color: isDark ? '#a78bfa' : '#7c3aed'
              }}
            >
              <Wallet className="w-4 h-4" /> Wallet Details
            </Link>

            <div className="text-right pl-2 border-l" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
              <p className="text-2xl font-bold text-neon-cyan">{investigation.progress || 0}%</p>
              <p className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Progress</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 rounded-full bg-midnight-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${investigation.progress || 0}%` }}
            transition={{ duration: 0.5 }}
            className={cn(
              'h-full rounded-full',
              investigation.status === 'COMPLETED' ? 'bg-neon-green' :
              investigation.status === 'FAILED' ? 'bg-neon-red' :
              'bg-gradient-to-r from-neon-cyan/60 to-neon-cyan',
            )}
          />
        </div>

        {/* Investigation Failure Banner & Retry Trigger */}
        {investigation.status === 'FAILED' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-200">Investigation Pipeline Failed</h4>
                <p className="text-xs text-rose-300 font-mono mt-0.5 break-all">
                  {investigation.failureReason || investigation.message || 'An unexpected worker or node timeout interrupted pipeline execution.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  You can resume and re-queue this investigation from the last verified checkpoint without losing earlier verified facts.
                </p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shrink-0 disabled:opacity-50"
            >
              <Loader2 className={cn('w-3.5 h-3.5', isRetrying && 'animate-spin')} />
              {isRetrying ? 'Re-queuing...' : 'Retry Investigation'}
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Interactive Stats Grid */}
      {investigation.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => setActiveTab('hops')} className="text-left group">
            <div className="glass-panel rounded-xl p-4 text-center transition-all group-hover:border-neon-cyan/50">
              <Network className="w-5 h-5 mx-auto mb-1 text-neon-cyan" />
              <p className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{investigation.stats.transactions || 0}</p>
              <p className="text-[10px] font-mono uppercase flex items-center justify-center gap-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                Transactions <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </button>

          <button onClick={() => setActiveTab('hops')} className="text-left group">
            <div className="glass-panel rounded-xl p-4 text-center transition-all group-hover:border-neon-violet/50">
              <Wallet className="w-5 h-5 mx-auto mb-1 text-neon-violet" />
              <p className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{investigation.stats.wallets || 0}</p>
              <p className="text-[10px] font-mono uppercase flex items-center justify-center gap-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                Wallets In Graph <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </button>

          <button onClick={() => setActiveTab('overview')} className="text-left group">
            <div className="glass-panel rounded-xl p-4 text-center transition-all group-hover:border-neon-green/50">
              <MapPin className="w-5 h-5 mx-auto mb-1 text-neon-green" />
              <p className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{investigation.stats.vaspMatches || 0}</p>
              <p className="text-[10px] font-mono uppercase flex items-center justify-center gap-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                VASP Matches <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </button>

          <button onClick={() => setActiveTab('overview')} className="text-left group">
            <div className="glass-panel rounded-xl p-4 text-center transition-all group-hover:border-neon-red/50">
              <Shield className="w-5 h-5 mx-auto mb-1 text-neon-red" />
              <p className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{investigation.stats.riskScore || 0}</p>
              <p className="text-[10px] font-mono uppercase flex items-center justify-center gap-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                Risk Score / 100 <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b overflow-x-auto pb-1" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
        {[
          { id: 'overview', label: 'Verdicts & Overview', icon: Layers },
          { id: 'hops', label: `Money Hops (${hops.length || (investigation.stats?.transactions || 0)})`, icon: GitFork },
          { id: 'branches', label: `Transfer Branches (${branches.length || 0})`, icon: GitBranch },
          { id: 'timeline', label: `Timeline (${timeline.length || '3'})`, icon: History },
          { id: 'bridges', label: `Cross-Chain Bridges (${bridges.length || investigation.stats?.crossChainTransfers || 0})`, icon: Network },
          { id: 'miners', label: `Miners & Producers (${miners.length || '1'})`, icon: Cpu },
          { id: 'pipeline', label: 'Pipeline Stages', icon: CheckCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                isActive
                  ? 'border shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-500/5'
              )}
              style={isActive ? {
                background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.12)',
                borderColor: isDark ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 150, 180, 0.3)',
                color: isDark ? '#00f0ff' : '#0891b2',
              } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: OVERVIEW & 3 LAYERS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {investigation.stats && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* LAYER 1 — Verified on-chain facts */}
              <div className="glass-panel rounded-xl p-6 border border-neon-cyan/20">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                  <Network className="w-4 h-4" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
                  On-Chain Facts
                </h3>
                <p className="text-[10px] font-mono uppercase mb-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Layer 1 — blockchain facts</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: 'Transactions', value: investigation.stats.transactions || 0 },
                    { label: 'Wallets', value: investigation.stats.wallets || 0 },
                    { label: 'Cross-Chain', value: investigation.stats.crossChainTransfers || 0 },
                    { label: 'Data Source', value: (investigation.stats.dataSourceMeta || 'LIVE Blockscout / Mempool').replace(' (', '\u00a0(') },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{item.label}</p>
                      <p className="font-medium text-xs font-mono truncate" style={{ color: isDark ? '#ffffff' : '#101318' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] mt-4 leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  All transaction hashes and block confirmations are cryptographically indexed with SHA-256 integrity verification.
                </p>
              </div>

              {/* LAYER 2 — Attribution (confidence-scored) */}
              <div className="glass-panel rounded-xl p-6 border border-neon-violet/20">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                  <MapPin className="w-4 h-4" style={{ color: isDark ? '#a78bfa' : '#7c3aed' }} />
                  VASP Attribution
                </h3>
                <p className="text-[10px] font-mono uppercase mb-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Layer 2 — confidence-scored, not identity</p>
                <div className="text-center py-2">
                  <p className="text-3xl font-bold" style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}>{investigation.stats.vaspMatches || 0}</p>
                  <p className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>service attributions identified</p>
                </div>
                <div className="mt-2 space-y-1 text-xs font-mono" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                  {(investigation.stats.attributions || []).map((attr: any, idx: number) => (
                    <div key={idx} className="flex justify-between border-b py-1" style={{ borderColor: isDark ? 'rgba(42,48,74,0.3)' : '#e2e8f0' }}>
                      <span className="truncate">{attr.vasp}</span>
                      <span className="text-neon-violet">{((attr.confidence || 0.95) * 100).toFixed(0)}% [{attr.attributionState || 'CONFIRMED'}]</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LAYER 3 — AI risk (explainable, non-binding) */}
              <div className="glass-panel rounded-xl p-6 border border-neon-red/20">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                  <Shield className="w-4 h-4" style={{ color: isDark ? '#ef4444' : '#dc2626' }} />
                  AI Risk Assessment
                </h3>
                <p className="text-[10px] font-mono uppercase mb-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Layer 3 — explainable, non-binding</p>
                <div className="text-center py-2">
                  <p className="text-4xl font-bold text-neon-red mb-1">{investigation.stats.riskScore || 0}</p>
                  <p className="text-xs font-mono text-neon-red/70">/100 {investigation.stats.riskScore >= 70 ? 'CRITICAL' : investigation.stats.riskScore >= 40 ? 'HIGH' : 'MEDIUM'}</p>
                </div>
                <p className="text-[10px] mt-3 leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  Detected patterns: {investigation.stats.patterns?.length ? investigation.stats.patterns.join(', ') : 'None'}. This score is a prioritization signal — it is never a verdict or proof of guilt.
                </p>
              </div>
            </motion.div>
          )}

          {/* Trace boundaries */}
          {investigation.stats?.boundaries?.length > 0 && (
            <div className="glass-panel rounded-xl p-6 border border-neon-amber/30">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                <AlertTriangle className="w-4 h-4 text-neon-amber" />
                Trace Boundaries ({investigation.stats.boundaries.length})
                {investigation.stats.traceIncomplete && (
                  <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full text-neon-amber bg-neon-amber/10 border border-neon-amber/30">PARTIAL RESULT</span>
                )}
              </h3>
              <div className="space-y-3">
                {investigation.stats.boundaries.map((b: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg" style={{ background: isDark ? 'rgba(255,170,0,0.05)' : 'rgba(200,120,0,0.04)' }}>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-neon-amber/40 text-neon-amber flex-shrink-0">{b.reason}</span>
                    <div>
                      <p className="text-xs font-mono" style={{ color: isDark ? '#e2e8f0' : '#334155' }}>{b.label || b.nodeAddress}</p>
                      <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{b.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <FileText className="w-4 h-4" style={{ color: isDark ? '#f59e0b' : '#d97706' }} />
              Forensic Action Recommendations
            </h3>
            <div className="space-y-3">
              {(investigation.stats?.recommendations && investigation.stats.recommendations.length > 0
                ? investigation.stats.recommendations
                : [
                    (investigation.stats?.transactions || 0) > 0
                      ? `Preserve all ${investigation.stats.transactions} transaction records with SHA-256 integrity hashes.`
                      : 'Synchronize verified on-chain ledger records for suspect address from archival RPC.',
                    (investigation.stats?.vaspMatches || 0) > 0
                      ? `Review ${investigation.stats.vaspMatches} VASP attribution(s) and issue Section 91 CrPC notice for LEA disclosure.`
                      : 'Expand forward multi-hop tracing depth to identify terminal custodial VASP off-ramps.',
                    'Issue Section 91 CrPC requisition notice to identified exchange compliance units.',
                    'Inspect identified intermediary wallets for potential syndicate campaign links.',
                    'Generate and sign official digital forensic report with SHA-256 evidence chain.',
                  ]
              ).map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-neon-amber/10 border border-neon-amber/30 flex items-center justify-center text-[10px] text-neon-amber font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: MONEY HOPS BREAKDOWN */}
      {activeTab === 'hops' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                Fund Flow Hops Breakdown ({hops.length} Hops Indexed)
              </h3>
              <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                Exact amounts transferred per sequential hop through the network with confirmed status
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 rounded-lg border bg-slate-900/40 border-slate-800 text-xs font-mono">
                <span className="text-slate-400 text-[10px] uppercase font-bold pl-1.5">View Hops:</span>
                {[1, 2, 3, 5, 10, 25, 50].map((d) => (
                  <Link
                    key={d}
                    href={`/dashboard/graph?address=${encodeURIComponent(investigation.suspectWallet)}&depth=${d}`}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-neon-cyan/20 transition-colors"
                  >
                    {d} Hops
                  </Link>
                ))}
              </div>

              <Link
                href={`/dashboard/graph?address=${encodeURIComponent(investigation.suspectWallet)}&depth=3`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 border border-neon-cyan/30 transition-colors"
              >
                Interactive Graph Trace <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0', background: isDark ? 'rgba(15,23,42,0.4)' : '#f8fafc' }}>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Hop #</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>From (Sender)</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>To (Receiver)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Transfer Amount</th>
                  <th className="text-center px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Confirmed Miner / Pool</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Tx Hash</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {hops.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                      No multi-hop transfers recorded yet. Launching live trace...
                    </td>
                  </tr>
                ) : (
                  hops.slice(0, visibleHopsCount).map((hop: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-slate-500/5 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                      <td className="px-4 py-3 font-mono text-xs">
                        <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold" style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.15)', color: isDark ? '#00f0ff' : '#0891b2' }}>
                          {hop.hopIndex || i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/dashboard/wallets/${encodeURIComponent(hop.from)}`} className="hover:underline truncate" style={{ color: isDark ? '#cbd5e1' : '#334155' }}>
                            {shortenAddress(hop.from, 8)}
                          </Link>
                          <button
                            onClick={() => copyToClipboard(hop.from, 'Sender Address')}
                            className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors"
                            title="Copy sender address"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/dashboard/wallets/${encodeURIComponent(hop.to)}`} className="hover:underline font-semibold truncate" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                            {shortenAddress(hop.to, 8)}
                          </Link>
                          <button
                            onClick={() => copyToClipboard(hop.to, 'Receiver Address')}
                            className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors"
                            title="Copy receiver address"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                        {formatAmount(hop.amount, 6)} <span className="text-[10px] opacity-75 font-normal">{hop.token || 'ETH'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border',
                          hop.status === 'PENDING' ? 'text-neon-amber bg-neon-amber/10 border-neon-amber/30' :
                          'text-neon-green bg-neon-green/10 border-neon-green/30'
                        )}>
                          {hop.status || 'CONFIRMED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono" style={{ background: isDark ? '#1a1e2f' : '#f1f5f9' }}>
                          {hop.miner || 'Validator Node'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        {hop.txHash ? (
                          <div className="flex items-center gap-1">
                            <span>{shortenAddress(hop.txHash, 6)}</span>
                            <button
                              onClick={() => copyToClipboard(hop.txHash, 'Transaction Hash')}
                              className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors"
                              title="Copy Tx Hash"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                        {hop.timestamp ? formatDate(hop.timestamp) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hops.length > 0 && (
            <div className="p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/30" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
              <span className="text-xs text-slate-400 font-mono">
                Showing {Math.min(visibleHopsCount, hops.length)} of {hops.length} trace hops
              </span>
              <div className="flex items-center gap-2">
                {visibleHopsCount < hops.length ? (
                  <button
                    onClick={() => setVisibleHopsCount((prev) => prev + 20)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 border border-neon-cyan/40 transition-all"
                  >
                    Load More Hops (Next 20)
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 font-mono italic">
                    All trace hops displayed
                  </span>
                )}
                <Link
                  href={`/dashboard/graph?address=${encodeURIComponent(investigation.suspectWallet)}&depth=10`}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-all"
                >
                  Deep Graph Canvas (50 Hops Max) <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* TAB CONTENT: TRANSFER BRANCHES & DISSEMINATION TREES */}
      {activeTab === 'branches' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass-panel rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                  <GitBranch className="w-4 h-4 text-neon-cyan" />
                  Fund Transfer Branches & Outflow Trees ({branches.length} Branch Origins)
                </h3>
                <p className="text-xs mt-0.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  Hierarchical fund dissemination tree showing how each wallet splits, fans out, or relays assets across hops
                </p>
              </div>

              <Link
                href={`/dashboard/graph?address=${encodeURIComponent(investigation.suspectWallet)}&depth=5`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 border border-neon-cyan/30 transition-colors"
              >
                Expand on Visual Graph <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {branches.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                No multi-branch transfers detected yet for this address.
              </div>
            ) : (
              <div className="space-y-6">
                {branches.map((branch, bIdx) => (
                  <div
                    key={bIdx}
                    className="p-5 rounded-xl border transition-all"
                    style={{
                      background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.8)',
                      borderColor: isDark ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 150, 180, 0.25)',
                    }}
                  >
                    {/* Branch Root / Origin */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30">
                          Branch #{bIdx + 1}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                          Source Origin:
                        </span>
                        <Link
                          href={`/dashboard/wallets/${encodeURIComponent(branch.sender)}`}
                          className="font-mono text-xs font-bold hover:underline"
                          style={{ color: isDark ? '#00f0ff' : '#0891b2' }}
                        >
                          {branch.sender}
                        </Link>
                        <button
                          onClick={() => copyToClipboard(branch.sender, 'Branch Origin Wallet')}
                          className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200"
                          title="Copy address"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Total Outflow:</span>
                        <span className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#101318' }}>
                          {formatAmount(branch.totalTransferred, 6)} {branch.token}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[11px]">
                          {branch.targets.length} sub-branches
                        </span>
                      </div>
                    </div>

                    {/* Sub-branch targets */}
                    <div className="mt-4 pl-2 sm:pl-6 space-y-2 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-neon-cyan/30">
                      {branch.targets.map((target: any, tIdx: number) => (
                        <div
                          key={tIdx}
                          className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border ml-3 transition-colors hover:border-neon-cyan/40"
                          style={{
                            background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                            borderColor: isDark ? 'rgba(42, 48, 74, 0.4)' : '#e2e8f0',
                          }}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <ArrowDownRight className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
                            <span className="text-[11px] font-mono text-slate-400">Hop {target.hopIndex || tIdx + 1} &rarr;</span>
                            <Link
                              href={`/dashboard/wallets/${encodeURIComponent(target.to)}`}
                              className="font-mono text-xs font-semibold hover:underline"
                              style={{ color: isDark ? '#ffffff' : '#0f172a' }}
                            >
                              {shortenAddress(target.to, 10)}
                            </Link>
                            <button
                              onClick={() => copyToClipboard(target.to, 'Transferred Target Wallet')}
                              className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200"
                              title="Copy target address"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border',
                              target.status === 'PENDING' ? 'text-neon-amber bg-neon-amber/10 border-neon-amber/30' :
                              'text-neon-green bg-neon-green/10 border-neon-green/30'
                            )}>
                              {target.status || 'CONFIRMED'}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono justify-end">
                            <div className="text-right">
                              <span className="font-bold text-xs" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                                {formatAmount(target.amount, 6)} <span className="text-[10px] opacity-75 font-normal">{target.token}</span>
                              </span>
                            </div>

                            {target.txHash && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <span>{shortenAddress(target.txHash, 6)}</span>
                                <button
                                  onClick={() => copyToClipboard(target.txHash, 'Transaction Hash')}
                                  className="p-0.5 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200"
                                  title="Copy Tx Hash"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <Link
                              href={`/dashboard/graph?address=${encodeURIComponent(target.to)}&depth=3`}
                              className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors"
                              style={{
                                background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.1)',
                                color: isDark ? '#00f0ff' : '#0891b2',
                              }}
                            >
                              Trace
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* TAB CONTENT 3: TIMELINE */}
      {activeTab === 'timeline' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-6"
        >
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <History className="w-4 h-4 text-neon-cyan" />
            Chronological Forensic Timeline
          </h3>

          <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700/50">
            {timeline.length === 0 ? (
              <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Timeline generated upon pipeline completion.</p>
            ) : (
              timeline.map((evt: any, idx: number) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-midnight-900"
                    style={{ borderColor: evt.type === 'INFLOW' ? '#00f0ff' : evt.type === 'OUTFLOW' ? '#ff4d4f' : '#a78bfa' }}
                  />
                  <div className="glass-panel rounded-xl p-4 ml-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{evt.title}</p>
                      <span className="text-[10px] font-mono text-slate-500">{formatDateTime(evt.timestamp)}</span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{evt.description}</p>
                    {evt.txHash && (
                      <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                        <span>Tx: {evt.txHash}</span>
                        <button
                          onClick={() => copyToClipboard(evt.txHash, 'Transaction Hash')}
                          className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Copy Tx Hash"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* TAB CONTENT 4: BRIDGES & CROSS-CHAIN */}
      {activeTab === 'bridges' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <Network className="w-4 h-4 text-neon-cyan" />
              Cross-Chain Bridges & Relay Contracts
            </h3>
            <Link href="/dashboard/cross-chain" className="text-xs text-neon-cyan hover:underline flex items-center gap-1">
              Cross-Chain Monitor <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {bridges.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                No active bridge routing detected in current hop distance.
              </div>
            ) : (
              bridges.map((br: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3"
                  style={{ background: isDark ? 'rgba(0, 240, 255, 0.03)' : 'rgba(0, 150, 180, 0.03)', borderColor: isDark ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 150, 180, 0.2)' }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{br.bridge || 'Cross-Chain Protocol'}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">
                        {br.correlation || 'CONFIRMED'}
                      </span>
                    </div>
                    <p className="text-xs mt-1 font-mono" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      Route: {br.sourceChain || 'Source'} → {br.destinationChain || 'Destination'}
                    </p>
                    {br.address && (
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] text-slate-400">
                        <span>Contract: {shortenAddress(br.address, 8)}</span>
                        <button
                          onClick={() => copyToClipboard(br.address, 'Bridge Contract')}
                          className="p-0.5 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200"
                          title="Copy Bridge Address"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>{br.amount || 'Cross-Chain Amount'}</p>
                    <p className="text-[10px]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Inter-Chain Liquidity Pool</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* TAB CONTENT 5: MINERS & PRODUCERS */}
      {activeTab === 'miners' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-6"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <Cpu className="w-4 h-4 text-neon-violet" />
            Consensus Infrastructure & Block Producers
          </h3>
          <p className="text-xs mb-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            Miners, mining pools, and proof-of-stake validators that verified and confirmed the suspect transactions on-chain.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {miners.length === 0 ? (
              <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Mining infrastructure details will appear upon confirmation.</p>
            ) : (
              miners.map((m: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border flex items-center justify-between"
                  style={{ background: isDark ? 'rgba(167, 139, 250, 0.04)' : 'rgba(124, 58, 237, 0.03)', borderColor: isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(124, 58, 237, 0.2)' }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{m.name}</p>
                      <button
                        onClick={() => copyToClipboard(m.name, 'Miner / Validator')}
                        className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200"
                        title="Copy validator name"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] font-mono mt-0.5 text-neon-violet">{m.type}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{m.blocksConfirmed || 1} block(s)</span>
                    <p className="text-[10px]" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{m.chain || 'Mainnet'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* TAB CONTENT 6: PIPELINE STAGES */}
      {activeTab === 'pipeline' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            {isRunning && <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />}
            Investigation Execution Pipeline
          </h2>

          <div className="space-y-1">
            {STAGES_ORDER.map((stage, i) => {
              const job = jobs.find((j) => j.stage === stage);
              const isCompleted = completedStages.includes(stage);
              const isCurrent = investigation.currentStage === stage;
              const isFailed = job?.status === 'FAILED';

              return (
                <div
                  key={stage}
                  className={cn(
                    'flex items-center gap-3 py-2 px-3 rounded-lg transition-all',
                    isCurrent && 'bg-neon-cyan/5 border border-neon-cyan/20',
                    isCompleted && 'opacity-70',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-neon-green flex-shrink-0" />
                  ) : isCurrent && isRunning ? (
                    <Loader2 className="w-4 h-4 text-neon-cyan animate-spin flex-shrink-0" />
                  ) : isFailed ? (
                    <AlertTriangle className="w-4 h-4 text-neon-red flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  )}
                  <span className={cn(
                    'text-sm',
                    isCompleted ? 'text-slate-400' :
                    isCurrent ? 'text-neon-cyan font-medium' :
                    'text-slate-600',
                  )}>
                    {STAGE_LABELS[stage]}
                  </span>
                  {job?.message && isCompleted && (
                    <span className="text-[10px] text-slate-600 ml-auto hidden md:inline">{job.message}</span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Action Buttons for Evidence & Legal Notices */}
      {investigation.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-4 pt-2"
        >
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all shadow-sm"
            style={{
              background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)',
              border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)',
              color: isDark ? '#00f0ff' : '#0891b2'
            }}
          >
            {generatingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            Download Forensic Report PDF
          </button>
          
          <button
            onClick={handleGenerateNotice}
            disabled={generatingNotice}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all shadow-sm"
            style={{
              background: isDark ? 'rgba(255, 170, 0, 0.15)' : 'rgba(200, 120, 0, 0.1)',
              border: isDark ? '1px solid rgba(255, 170, 0, 0.4)' : '1px solid rgba(200, 120, 0, 0.3)',
              color: isDark ? '#ffaa00' : '#b37700'
            }}
          >
            {generatingNotice ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
            Generate Section 91 CrPC Notice
          </button>
        </motion.div>
      )}
    </div>
  );
}

