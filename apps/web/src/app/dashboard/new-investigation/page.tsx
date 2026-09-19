'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Shield, Wallet, FileText, Search, Zap,
  CheckCircle, Loader2, HelpCircle, ExternalLink,
} from 'lucide-react';
import { casesApi, investigationsApi } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { cn } from '@/lib/utils';
import { FraudType } from '@chainsentinel/types';

const FRAUD_TYPE_LABELS: Record<string, string> = Object.values(FraudType).reduce((acc, val) => {
  acc[val] = val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return acc;
}, {} as Record<string, string>);

const STEPS = [
  { title: 'Case Details', icon: FileText },
  { title: 'Suspect / Target Wallet', icon: Wallet },
  { title: 'Analysis Config', icon: Search },
  { title: 'Launch', icon: Zap },
];

const FRAUD_TYPES = Object.entries(FRAUD_TYPE_LABELS);

export default function NewInvestigation() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [step, setStep] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);

  const [autoHops, setAutoHops] = useState(true);

  const [form, setForm] = useState({
    title: '',
    fraudType: 'INVESTMENT_SCAM',
    description: '',
    suspectWallet: '',
    blockchain: 'auto',
    cryptocurrency: 'USDT',
    estimatedAmount: '',
    victimReference: '',
    maxHops: '5',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));


  const handleSubmit = async () => {
    setIsLaunching(true);
    try {
      const { data: caseData } = await casesApi.create({
        title: form.title || `Investigation - ${form.suspectWallet.substring(0, 10)}`,
        fraudType: form.fraudType,
        description: form.description,
        complaint: {
          suspectWalletAddress: form.suspectWallet,
          blockchain: form.blockchain === 'auto' ? undefined : form.blockchain,
          cryptocurrency: form.cryptocurrency,
          estimatedFraudAmount: form.estimatedAmount || undefined,
          victimReference: form.victimReference || undefined,
          description: form.description,
        },
      });

      const caseId = caseData.data.id;
      const { data: invData } = await investigationsApi.create({
        caseId,
        suspectWallet: form.suspectWallet,
        blockchain: form.blockchain === 'auto' ? undefined : form.blockchain,
      });

      addToast('success', `Investigation started for ${caseData.data.caseNumber}`);
      router.push(`/dashboard/investigations/${invData.data.id}`);
    } catch (error: any) {
      addToast('error', error.response?.data?.error?.message || 'Failed to create investigation');
    } finally {
      setIsLaunching(false);
    }
  };

  // Theme-aware input style
  const inputStyle = {
    background: isDark ? '#1a1e2f' : '#f1f5f9',
    border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`,
    color: isDark ? '#ffffff' : '#101318',
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <Shield className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          New Intelligence Investigation
        </h1>
        <p className="text-sm mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Initiate blockchain fraud analysis</p>
      </motion.div>

      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i <= step
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50'
                : 'text-slate-500 border',
            )} style={i > step ? { background: isDark ? '#1a1e2f' : '#f1f5f9', borderColor: isDark ? '#2a304a' : '#e2e8f0' } : undefined}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-12 h-0.5 mx-1', i < step ? 'bg-neon-cyan/50' : '')} style={i >= step ? { background: isDark ? '#2a304a' : '#e2e8f0' } : undefined} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="glass-panel rounded-2xl p-8"
        >
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4" style={{ color: isDark ? '#ffffff' : '#101318' }}>Case Information</h2>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Case Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  placeholder="e.g., Cryptocurrency Investment Fraud"
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Fraud Type *</label>
                <select
                  value={form.fraudType}
                  onChange={(e) => update('fraudType', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                >
                  {FRAUD_TYPES.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all resize-none"
                  style={inputStyle}
                  placeholder="Describe the fraud case..."
                />
              </div>
              <div>
                <label className="block text-sm mb-1.5 font-medium" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                  Victim Wallet Address / ID (Optional)
                </label>
                <input
                  value={form.victimReference}
                  onChange={(e) => update('victimReference', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all font-mono"
                  style={inputStyle}
                  placeholder="e.g., 0x2a5603942ce823df3048d8e2a99ab18cf74b7169 or VIC-102"
                />
                <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  If a valid crypto address is provided, the transaction graph will automatically map the victim node and trace fund flow to the suspect.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Suspect or Target Wallet</h2>
                <p className="text-xs text-slate-400 mt-0.5">Specify the suspect cryptocurrency wallet address to initiate automated multi-hop blockchain tracing</p>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Target Suspect Wallet Address *</label>
                <input
                  value={form.suspectWallet}
                  onChange={(e) => update('suspectWallet', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm font-mono outline-none transition-all font-semibold"
                  style={inputStyle}
                  placeholder="0x... or T... or 1..."
                />
                <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Blockchain network will be auto-detected from address format</p>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Victim Wallet Address (Optional)</label>
                <input
                  value={form.victimReference}
                  onChange={(e) => update('victimReference', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm font-mono outline-none transition-all"
                  style={inputStyle}
                  placeholder="e.g., 0x2a5603942ce823df3048d8e2a99ab18cf74b7169"
                />
                <p className="text-xs mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Connects directly to suspect in visual transaction graph when confirmed</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Cryptocurrency</label>
                  <select
                    value={form.cryptocurrency}
                    onChange={(e) => update('cryptocurrency', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                    style={inputStyle}
                  >
                    {['USDT', 'ETH', 'BTC', 'USDC', 'TRX', 'BNB', 'SOL'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Estimated Fraud Amount ($ USD)</label>
                  <input
                    value={form.estimatedAmount}
                    onChange={(e) => update('estimatedAmount', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all font-mono"
                    style={inputStyle}
                    placeholder="e.g., 200"
                  />
                  <p className="text-[11px] mt-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Amount in USD. Visual graph filters and displays node cards in $.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Analysis Configuration</h2>

              {/* Auto Hops dynamic mode toggle */}
              <div
                onClick={() => setAutoHops(!autoHops)}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3',
                  autoHops ? 'bg-neon-cyan/10 border-neon-cyan/50' : 'bg-slate-900/40 border-slate-800'
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neon-cyan">
                      Auto-Hops Mode (Smart Terminal Boundary Stopping)
                    </h3>
                    <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded font-bold', autoHops ? 'bg-neon-cyan text-slate-950' : 'bg-slate-800 text-slate-400')}>
                      {autoHops ? 'ENABLED' : 'MANUAL DEPTH'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    When enabled, the pipeline automatically traces forward until it discovers a regulated exchange / VASP deposit address (such as Binance, OKX, WazirX) or an anonymizing mixer, terminating the path at the optimal legal boundary for Section 91 notices.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoHops}
                  onChange={(e) => setAutoHops(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded accent-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                    {autoHops ? 'Maximum Trace Bound (Safety Cap)' : 'Fixed Tracing Depth (Hops)'}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={form.maxHops}
                      onChange={(e) => update('maxHops', e.target.value)}
                      className="flex-1 px-4 py-3 rounded-lg text-sm outline-none transition-all"
                      style={inputStyle}
                    >
                      <option value="3">3 hops (Fast)</option>
                      <option value="5">5 hops (Standard)</option>
                      <option value="10">10 hops (Deep Forensic)</option>
                      <option value="25">25 hops (Extended Syndicate)</option>
                      <option value="50">50 hops (Maximum Comprehensive)</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={form.maxHops}
                      onChange={(e) => update('maxHops', e.target.value)}
                      className="w-20 px-3 py-3 rounded-lg text-sm font-mono font-bold text-center outline-none"
                      style={inputStyle}
                      title="Custom Hops Number (1-50)"
                      placeholder="Custom"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Select preset or enter custom number of hops (1-50)</p>
                </div>
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Min Amount Filter</label>
                  <select className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all" style={inputStyle}>
                    <option value="0">No minimum (Trace All)</option>
                    <option value="50">$50 threshold</option>
                    <option value="100">$100 threshold</option>
                    <option value="1000">$1,000 threshold</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Prunes dust transfers to keep graph clean</p>
                </div>
              </div>
              <div className="p-4 rounded-lg" style={{ background: isDark ? 'rgba(0, 240, 255, 0.05)' : 'rgba(0, 150, 180, 0.04)', border: isDark ? '1px solid rgba(0, 240, 255, 0.2)' : '1px solid rgba(0, 150, 180, 0.15)' }}>
                <h4 className="text-sm font-medium mb-2" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>Analysis Pipeline</h4>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  {[
                    '✓ Address validation',
                    '✓ Chain detection',
                    '✓ Transaction ingestion',
                    '✓ Graph generation',
                    '✓ Fund-flow tracing',
                    '✓ Entity matching',
                    '✓ Cross-chain analysis',
                    '✓ Risk scoring',
                    '✓ VASP attribution',
                    '✓ Pattern detection',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full" style={{ background: isDark ? 'rgba(0, 240, 255, 0.5)' : 'rgba(0, 150, 180, 0.5)' }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                style={{ background: isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 150, 180, 0.08)', border: isDark ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(0, 150, 180, 0.2)' }}
              >
                <Zap className="w-10 h-10" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
              </motion.div>
              <h2 className="text-xl font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>Ready to Launch Investigation</h2>
              <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                The system will perform automated blockchain analysis on<br />
                <span className="font-mono" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>{form.suspectWallet || 'No wallet specified'}</span>
              </p>
              <div className="inline-flex flex-col gap-2 text-sm text-left glass-panel rounded-lg p-4 mt-4">
                <div className="flex justify-between gap-8">
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Title:</span>
                  <span style={{ color: isDark ? '#ffffff' : '#101318' }}>{form.title || 'Untitled'}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Type:</span>
                  <span style={{ color: isDark ? '#ffffff' : '#101318' }}>{FRAUD_TYPE_LABELS[form.fraudType] || form.fraudType}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Wallet:</span>
                  <span className="font-mono text-xs" style={{ color: isDark ? '#ffffff' : '#101318' }}>{form.suspectWallet || '-'}</span>
                </div>
                {form.estimatedAmount && (
                  <div className="flex justify-between gap-8">
                    <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Amount:</span>
                    <span style={{ color: isDark ? '#ffffff' : '#101318' }}>{form.cryptocurrency} {form.estimatedAmount}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: isDark ? '#94a3b8' : '#64748b' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !form.suspectWallet}
            className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLaunching || !form.suspectWallet}
            className="flex items-center gap-2 px-8 py-3 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: isDark ? '#00f0ff' : '#0891b2', color: isDark ? '#0a0c14' : '#ffffff' }}
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Launching...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> START INTELLIGENCE ANALYSIS
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
