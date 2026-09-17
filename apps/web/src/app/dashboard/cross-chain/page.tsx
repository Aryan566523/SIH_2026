'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Link2, AlertCircle, ArrowRight, Copy } from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme.store';
import { crossChainApi } from '@/lib/api';

interface CrossChainTransfer {
  id: string;
  sourceChain: string;
  sourceWallet: string;
  sourceTransaction: string;
  sourceAsset: string;
  bridge: string;
  destinationChain: string;
  destinationTransaction: string | null;
  destinationWallet: string | null;
  destinationAsset: string;
  confidence: number;
  amount: string;
  timestamp: string;
}

export default function CrossChainPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [transfers, setTransfers] = useState<CrossChainTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await crossChainApi.list();
        const data = response.data?.data || response.data;
        setTransfers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch transfers:', err);
        setError('Failed to load cross-chain transfers.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransfers();
  }, []);

  const truncate = (str: string | null) => {
    if (!str) return '-';
    if (str.length <= 12) return str;
    return `${str.substring(0, 6)}...${str.substring(str.length - 4)}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <Link2 className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Cross-Chain Monitor
      </h1>
      
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: isDark ? '#00f0ff' : '#0891b2' }}></div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc' }}>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Time</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Bridge</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Source Route</th>
                  <th className="p-4 font-medium text-sm text-center" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Direction</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Destination Route</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Amount</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Confidence</th>
                  <th className="p-4 font-medium text-sm text-right" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      No cross-chain transfers found.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#e2e8f0' : '#1e293b' }} className="hover:bg-slate-500/5 transition-colors">
                      <td className="p-4 text-xs font-mono whitespace-nowrap">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-4 text-xs font-bold font-mono text-neon-cyan">{t.bridge}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t.sourceChain}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Link href={`/dashboard/wallets/${encodeURIComponent(t.sourceWallet)}`} className="text-xs font-mono font-medium hover:underline text-slate-200">
                              {truncate(t.sourceWallet)}
                            </Link>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(t.sourceWallet);
                              }}
                              className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                              title="Copy source address"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <ArrowRight className="w-4 h-4 mx-auto text-slate-400" />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">{t.destinationChain}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Link href={`/dashboard/wallets/${encodeURIComponent(t.destinationWallet || '')}`} className="text-xs font-mono font-medium hover:underline text-slate-200">
                              {truncate(t.destinationWallet)}
                            </Link>
                            {t.destinationWallet && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(t.destinationWallet!);
                                }}
                                className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Copy destination address"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-mono">
                        <span className="font-bold text-white">{t.amount}</span>
                        {!t.amount.includes('->') && <span className="text-[10px] text-slate-400 ml-1">{t.sourceAsset}</span>}
                      </td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          t.confidence > 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          t.confidence > 70 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}>
                          {t.confidence}%
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/dashboard/graph?address=${encodeURIComponent(t.sourceWallet)}&depth=3`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 border border-neon-cyan/30 text-[11px] font-mono font-semibold transition-colors"
                        >
                          Trace Route <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
