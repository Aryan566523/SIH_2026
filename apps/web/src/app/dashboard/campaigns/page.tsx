'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileWarning, AlertCircle, X, Shield, ExternalLink, Network, Copy, Check, Info } from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme.store';
import { fraudCampaignsApi } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  identifiedDate: string;
  associatedWallets: number;
  estimatedTotalValue: number;
  riskScore: number;
  targetDemographic: string;
  modusOperandi?: string;
  primarySuspect?: string;
  sampleWallets?: string[];
}

export default function CampaignsPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { addToast } = useUIStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fraudCampaignsApi.list();
        const data = response.data?.data || response.data;
        setCampaigns(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch campaigns:', err);
        setError('Failed to load fraud campaigns.');
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    addToast('Address copied to clipboard', 'success' as any);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <FileWarning className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
            Fraud Campaigns & Syndicate Hub
          </h1>
          <p className="text-xs font-mono mt-1 text-slate-400">
            Click on any campaign row to inspect identified target wallets, modus operandi, and initiate multi-hop traces.
          </p>
        </div>
      </div>
      
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
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Campaign Name</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Typology</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Status</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Identified</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Wallets</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Estimated Loss</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                      No fraud campaigns found.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCampaign(c)}
                      style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#e2e8f0' : '#1e293b' }}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-4 text-sm font-semibold flex items-center gap-2">
                        <span className="text-neon-cyan hover:underline">{c.name}</span>
                      </td>
                      <td className="p-4 text-xs">{c.type}</td>
                      <td className="p-4 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Active' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                          c.status === 'Investigating' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-mono">{new Date(c.identifiedDate).toLocaleDateString()}</td>
                      <td className="p-4 text-xs font-mono font-bold text-neon-cyan">{c.associatedWallets} Wallets</td>
                      <td className="p-4 text-xs font-mono font-bold text-white">${c.estimatedTotalValue.toLocaleString()} USD</td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-slate-700 overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${c.riskScore}%`,
                                backgroundColor: c.riskScore > 80 ? '#ef4444' : c.riskScore > 50 ? '#f59e0b' : '#10b981'
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold">{c.riskScore}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 border shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#334155' : '#cbd5e1',
            }}
          >
            <div className="flex items-start justify-between border-b pb-4" style={{ borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 uppercase font-bold">
                  {selectedCampaign.type}
                </span>
                <h2 className="text-lg font-bold text-white mt-1.5">{selectedCampaign.name}</h2>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Fact Cards */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="text-slate-400 font-mono text-[10px] uppercase">Associated Wallets</p>
                <p className="text-base font-bold text-neon-cyan font-mono mt-0.5">{selectedCampaign.associatedWallets}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="text-slate-400 font-mono text-[10px] uppercase">Estimated Laundering</p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">${selectedCampaign.estimatedTotalValue.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="text-slate-400 font-mono text-[10px] uppercase">Threat Risk Score</p>
                <p className="text-base font-bold text-neon-red font-mono mt-0.5">{selectedCampaign.riskScore}/100</p>
              </div>
            </div>

            {/* Modus Operandi */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
              <p className="text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-neon-cyan" /> Modus Operandi & Typology Execution
              </p>
              <p className="text-slate-300 leading-relaxed">
                {selectedCampaign.modusOperandi || 'Victims lured through organized fraud vectors, resulting in automated multi-hop layered transfers to unregulated unhosted or offshore addresses.'}
              </p>
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Target Demographic:</span> {selectedCampaign.targetDemographic}
              </p>
            </div>

            {/* Associated Wallets & Primary Suspects */}
            <div>
              <p className="text-xs font-mono uppercase text-slate-400 mb-2 font-bold">Identified Suspect Cluster Wallets</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(selectedCampaign.sampleWallets || [selectedCampaign.primarySuspect]).filter(Boolean).map((w, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-200 truncate">{w}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        onClick={() => copyAddress(w!)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Copy wallet address"
                      >
                        {copiedAddr === w ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <Link
                        href={`/dashboard/wallets/${encodeURIComponent(w!)}`}
                        className="px-2 py-1 rounded bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 border border-neon-cyan/30 text-[11px] font-sans font-semibold transition-colors flex items-center gap-1"
                      >
                        Wallet Intel <ExternalLink className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/dashboard/graph?address=${encodeURIComponent(w!)}`}
                        className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/30 text-[11px] font-sans font-semibold transition-colors flex items-center gap-1"
                      >
                        Trace Graph <Network className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white border border-slate-700"
              >
                Close
              </button>
              {selectedCampaign.primarySuspect && (
                <Link
                  href={`/dashboard/graph?address=${encodeURIComponent(selectedCampaign.primarySuspect)}&depth=3`}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-neon-cyan text-black hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Network className="w-3.5 h-3.5" /> Launch Multi-Hop Trace (3 Hops)
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
