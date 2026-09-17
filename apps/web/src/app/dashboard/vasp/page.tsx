'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Search,
  ExternalLink,
  Shield,
  FileText,
  Mail,
  Scale,
  Copy,
  CheckCircle2,
  X,
  Layers,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { vaspApi } from '@/lib/api';
import { cn, shortenAddress } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';
import { useUIStore } from '@/lib/stores/ui.store';

const typeColors: Record<string, string> = {
  centralized_exchange: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  decentralized_exchange: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  bridge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  mixer: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  payment_service: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  gambling: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
};

export default function VaspPage() {
  const [vasps, setVasps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeVasp, setActiveVasp] = useState<any | null>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { addToast } = useUIStore();

  useEffect(() => {
    const fetchVasps = async () => {
      try {
        const { data } = await vaspApi.list({ limit: 50 });
        setVasps(data.data || []);
      } catch {
        setVasps([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVasps();
  }, []);

  const copyText = (txt: string, msg = 'Copied') => {
    navigator.clipboard.writeText(txt);
    addToast('success', msg);
  };

  const filteredVasps = vasps.filter((v) => {
    const matchesSearch =
      v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.jurisdiction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Array.isArray(v.wallets) && v.wallets.some((w: string) => w.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesType = selectedType === 'all' || v.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <Building2 className="w-6 h-6 text-neon-cyan" />
            VASP & Exchange Intelligence Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official repository of Virtual Asset Service Providers, FIU-IND reporting entities, compliance nodal desks, and verified wallet clusters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg border bg-slate-900/40 text-xs font-mono text-slate-300">
            <span className="text-neon-cyan font-bold">{vasps.length}</span> Registered Entities
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by exchange name, jurisdiction, or wallet address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border bg-slate-900/40 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-neon-cyan transition-colors"
            style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.6)' : '#cbd5e1' }}
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs border bg-slate-900/60 text-slate-200 focus:outline-none focus:border-neon-cyan"
          style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.6)' : '#cbd5e1' }}
        >
          <option value="all">All Entity Types</option>
          <option value="centralized_exchange">Centralized Exchanges (CEX)</option>
          <option value="bridge">Cross-Chain Bridges</option>
          <option value="mixer">Mixers & Privacy Protocols</option>
          <option value="decentralized_exchange">DEX Protocols</option>
        </select>
      </div>

      {/* VASP Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : filteredVasps.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-xl">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No VASP entities match your search criteria</p>
          <p className="text-xs text-slate-500 mt-1">Try searching by exchange name or wallet address</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVasps.map((vasp, i) => {
            const walletsList: string[] = Array.isArray(vasp.wallets)
              ? vasp.wallets
              : typeof vasp.wallets === 'string'
              ? JSON.parse(vasp.wallets || '[]')
              : [];
            const isSanctioned = vasp.type === 'mixer' || vasp.metadata?.sanctioned;

            return (
              <motion.div
                key={vasp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setActiveVasp(vasp)}
                className="glass-panel rounded-xl p-5 hover:border-neon-cyan/50 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-neon-cyan transition-colors">
                        {vasp.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold border uppercase',
                            typeColors[vasp.type] || typeColors.centralized_exchange
                          )}
                        >
                          {vasp.type?.replace(/_/g, ' ')}
                        </span>
                        {isSanctioned ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            SANCTIONED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            VERIFIED
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-mono font-bold text-neon-cyan">{vasp.confidence}%</p>
                      <p className="text-[10px] text-slate-400">confidence</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Jurisdiction:</span>
                      <span className="font-medium text-white">{vasp.jurisdiction || 'Global'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Known Cluster:</span>
                      <span className="font-mono text-neon-cyan font-semibold">{walletsList.length} wallets</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Networks:</span>
                      <span className="font-semibold text-slate-200">
                        {Array.isArray(vasp.chains) ? vasp.chains.join(', ') : 'ETHEREUM'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-neon-cyan transition-colors">
                  <span>Inspect Legal & Cluster Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* VASP Drill-Down Inspection Modal */}
      <AnimatePresence>
        {activeVasp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0e131f] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-slate-200"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveVasp(null)}
                className="absolute top-5 right-5 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="p-3 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20">
                  <Building2 className="w-6 h-6 text-neon-cyan" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{activeVasp.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold border uppercase',
                        typeColors[activeVasp.type] || typeColors.centralized_exchange
                      )}
                    >
                      {activeVasp.type?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400">Jurisdiction: {activeVasp.jurisdiction || 'Global'}</span>
                  </div>
                </div>
              </div>

              {/* Compliance & Legal Notice Box */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-neon-cyan uppercase tracking-wider">
                    <Scale className="w-4 h-4" /> Law Enforcement & Section 91 CrPC Liaison
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <p className="text-[10px] font-mono text-slate-400 uppercase">Legal Operating Entity</p>
                      <p className="font-semibold text-white">{activeVasp.metadata?.legalEntity || activeVasp.name}</p>
                    </div>
                    {activeVasp.metadata?.fiuRegistrationNumber && (
                      <div>
                        <p className="text-[10px] font-mono text-slate-400 uppercase">FIU-IND Registration</p>
                        <p className="font-mono font-bold text-emerald-400">{activeVasp.metadata.fiuRegistrationNumber}</p>
                      </div>
                    )}
                  </div>

                  {activeVasp.metadata?.complianceOfficer && (
                    <div className="text-xs">
                      <p className="text-[10px] font-mono text-slate-400 uppercase">Nodal / Compliance Officer</p>
                      <p className="font-medium text-slate-300 mt-0.5">{activeVasp.metadata.complianceOfficer}</p>
                    </div>
                  )}

                  {activeVasp.metadata?.complianceEmail && (
                    <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                        <span className="font-mono text-slate-300 truncate">{activeVasp.metadata.complianceEmail}</span>
                      </div>
                      <button
                        onClick={() => copyText(activeVasp.metadata.complianceEmail, 'Compliance email copied')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-white shrink-0 ml-2"
                      >
                        Copy
                      </button>
                    </div>
                  )}

                  {activeVasp.metadata?.freezeMechanism && (
                    <div className="text-xs pt-1">
                      <span className="text-slate-400">Fund Freezing Mechanism: </span>
                      <span className="font-semibold text-white">{activeVasp.metadata.freezeMechanism}</span>
                    </div>
                  )}
                </div>

                {/* Known Clustered Wallets */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-neon-cyan" />
                    Verified Custodial & Hot/Cold Wallets (
                    {Array.isArray(activeVasp.wallets)
                      ? activeVasp.wallets.length
                      : typeof activeVasp.wallets === 'string'
                      ? JSON.parse(activeVasp.wallets || '[]').length
                      : 0}
                    )
                  </h4>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(Array.isArray(activeVasp.wallets)
                      ? activeVasp.wallets
                      : typeof activeVasp.wallets === 'string'
                      ? JSON.parse(activeVasp.wallets || '[]')
                      : []
                    ).map((walletAddr: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-xs hover:border-slate-700"
                      >
                        <span className="font-mono text-slate-300">{walletAddr}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyText(walletAddr, 'Wallet address copied')}
                            className="p-1 hover:text-white text-slate-400"
                            title="Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/dashboard/wallets/${walletAddr}`}
                            className="p-1 text-neon-cyan hover:text-cyan-300"
                            title="Inspect Intelligence"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setActiveVasp(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 hover:bg-slate-800 text-slate-300"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      copyText(
                        `LEGAL SUBPOENA NOTICE (CrPC SECTION 91 / BNS 94)\nTarget VASP: ${activeVasp.name}\nLegal Entity: ${activeVasp.metadata?.legalEntity || activeVasp.name}\nCompliance Contact: ${activeVasp.metadata?.complianceEmail || 'N/A'}\nJurisdiction: ${activeVasp.jurisdiction}\nFreeze Mechanism: ${activeVasp.metadata?.freezeMechanism || 'Emergency API Freezing'}`,
                        'Subpoena header copied for investigation dispatch'
                      );
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-neon-cyan text-slate-950 hover:bg-cyan-300 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Copy Subpoena / Notice Header
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

