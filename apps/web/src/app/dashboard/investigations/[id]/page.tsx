'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Loader2, Circle, AlertTriangle, Clock,
  Wallet, Network, MapPin, Shield, FileText, ArrowRight,
} from 'lucide-react';
import { investigationsApi } from '@/lib/api';
import { cn, formatDate, formatDateTime, getRiskColor } from '@/lib/utils';
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
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const addToast = useUIStore((s) => s.addToast);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingNotice, setGeneratingNotice] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-xl p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
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
            <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              Suspect: <span className="font-mono" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>{investigation.suspectWallet}</span>
            </p>
            {investigation.blockchain && (
              <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Chain: {investigation.blockchain}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold text-neon-cyan">{investigation.progress || 0}%</p>
            <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Progress</p>
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
      </motion.div>

      {/* Stats */}
      {investigation.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Transactions', value: investigation.stats.transactions || 0, icon: Network, color: 'text-neon-cyan' },
            { label: 'Wallets', value: investigation.stats.wallets || 0, icon: Wallet, color: 'text-neon-violet' },
            { label: 'VASP Matches', value: investigation.stats.vaspMatches || 0, icon: MapPin, color: 'text-neon-green' },
            { label: 'Risk Score', value: investigation.stats.riskScore || 0, icon: Shield, color: 'text-neon-red' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-panel rounded-xl p-4 text-center"
            >
              <stat.icon className={cn('w-5 h-5 mx-auto mb-1', stat.color)} />
              <p className="text-xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{stat.value}</p>
              <p className="text-[10px] font-mono uppercase" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tracing steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel rounded-xl p-6"
      >
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          {isRunning && <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />}
          Investigation Pipeline
        </h2>

        <div className="space-y-1">
          {STAGES_ORDER.map((stage, i) => {
            const job = jobs.find((j) => j.stage === stage);
            const isCompleted = completedStages.includes(stage);
            const isCurrent = investigation.currentStage === stage;
            const isFailed = job?.status === 'FAILED';

            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.03 }}
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
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Investigation completed - show results */}
      {investigation.status === 'COMPLETED' && investigation.stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Investigation Summary */}
          <div className="glass-panel rounded-xl p-6 border border-neon-green/20">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <MapPin className="w-4 h-4" style={{ color: isDark ? '#00ff88' : '#10b981' }} />
              Investigation Results
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Transactions Analyzed', value: investigation.stats.transactions || 0 },
                { label: 'Wallets Identified', value: investigation.stats.wallets || 0 },
                { label: 'VASP Matches', value: investigation.stats.vaspMatches || 0 },
                { label: 'Bridge Interactions', value: investigation.stats.bridges || 0 },
                { label: 'Cross-Chain Transfers', value: investigation.stats.crossChainTransfers || 0 },
                { label: 'Risk Score', value: investigation.stats.riskScore || 'N/A' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{item.label}</p>
                  <p className="font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="glass-panel rounded-xl p-6 border border-neon-red/20">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <Shield className="w-4 h-4" style={{ color: isDark ? '#ef4444' : '#dc2626' }} />
              Risk Assessment
            </h3>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-neon-red mb-1">{investigation.stats.riskScore || 0}</p>
              <p className="text-xs font-mono text-neon-red/70">/100 {investigation.stats.riskScore >= 70 ? 'CRITICAL' : investigation.stats.riskScore >= 40 ? 'HIGH' : 'MEDIUM'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommendations */}
      {investigation.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-panel rounded-xl p-6"
        >            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <FileText className="w-4 h-4" style={{ color: isDark ? '#f59e0b' : '#d97706' }} />
            Investigative Recommendations
          </h3>
          <div className="space-y-3">
            {[
              `Preserve all ${investigation.stats?.transactions || 0} transaction records with SHA-256 integrity hashes.`,
              `Review ${investigation.stats?.vaspMatches || 0} VASP attribution(s) for coordination opportunities.`,
              `Continue monitoring ${investigation.stats?.crossChainTransfers || 0} cross-chain transfer(s) for fund recovery.`,
              'Investigate identified intermediary wallets for potential fraud campaign links.',
              'Generate formal investigation report for case documentation.',
            ].map((rec, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-neon-amber/10 border border-neon-amber/30 flex items-center justify-center text-[10px] text-neon-amber font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{rec}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      {/* Actions */}
      {investigation.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap gap-4"
        >
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all"
            style={{
              background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)',
              border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)',
              color: isDark ? '#00f0ff' : '#0891b2'
            }}
          >
            {generatingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            Generate Report PDF
          </button>
          
          <button
            onClick={handleGenerateNotice}
            disabled={generatingNotice}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all"
            style={{
              background: isDark ? 'rgba(255, 170, 0, 0.15)' : 'rgba(200, 120, 0, 0.1)',
              border: isDark ? '1px solid rgba(255, 170, 0, 0.4)' : '1px solid rgba(200, 120, 0, 0.3)',
              color: isDark ? '#ffaa00' : '#b37700'
            }}
          >
            {generatingNotice ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
            Generate Section 91 Notice
          </button>
        </motion.div>
      )}
    </div>
  );
}
