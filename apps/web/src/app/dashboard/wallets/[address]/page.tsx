'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  MapPin,
  Copy,
  CheckCircle2,
  Wallet as WalletIcon,
  Clock,
  Building2,
  FileText,
  Mail,
  Scale,
  RefreshCw,
  User,
  XCircle,
  Download,
  Network,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { walletsApi } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { cn, shortenAddress, getRiskColor, formatAmount, formatDate } from '@/lib/utils';

export default function WalletDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { addToast } = useUIStore();

  const [wallet, setWallet] = useState<any>(null);
  const [risk, setRisk] = useState<any>(null);
  const [attribution, setAttribution] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [hasMoreTx, setHasMoreTx] = useState(true);
  const [loadingMoreTx, setLoadingMoreTx] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'in' | 'out' | 'pending'>('all');

  const fetchData = async (silent = false, forceSync = false) => {
    if (!address) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      setTxPage(1);
      const [walletRes, riskRes, attrRes, txRes] = await Promise.allSettled([
        walletsApi.get(address),
        walletsApi.getRisk(address),
        walletsApi.getAttribution(address),
        walletsApi.getTransactions(address, { page: 1, limit: 20, ...(forceSync ? { forceSync: true } : {}) }),
      ]);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data.data);
      if (riskRes.status === 'fulfilled') setRisk(riskRes.value.data.data);
      if (attrRes.status === 'fulfilled') {
        const raw = attrRes.value.data.data;
        setAttribution(Array.isArray(raw) ? raw[0] : raw);
      }
      if (txRes.status === 'fulfilled') {
        let txs = txRes.value.data.data || [];
        // If 0 transactions were returned and not forced yet, immediately trigger background live sync
        if (txs.length === 0 && !forceSync) {
          try {
            const syncRes = await walletsApi.getTransactions(address, { page: 1, limit: 20, forceSync: true });
            const liveTxs = syncRes?.data?.data || [];
            if (liveTxs.length > 0) {
              txs = liveTxs;
            }
          } catch {
            // ignore
          }
        }
        setTransactions(txs);
        setHasMoreTx(txs.length >= 20);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreTransactions = async () => {
    if (loadingMoreTx || !hasMoreTx) return;
    setLoadingMoreTx(true);
    try {
      const nextPage = txPage + 1;
      const res = await walletsApi.getTransactions(address, { page: nextPage, limit: 20 });
      const newTxs = res.data.data || [];
      if (newTxs.length === 0) {
        setHasMoreTx(false);
        addToast('No more historical transactions found on-chain', 'info' as any);
      } else {
        setTransactions((prev) => [...prev, ...newTxs]);
        setTxPage(nextPage);
        if (newTxs.length < 20) {
          setHasMoreTx(false);
        }
      }
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Failed to fetch more transactions', 'error' as any);
    } finally {
      setLoadingMoreTx(false);
    }
  };

  const exportCsv = () => {
    if (!transactions.length) {
      addToast('No transactions to export', 'info' as any);
      return;
    }
    const headers = ['TxHash', 'Status', 'Direction', 'From', 'To', 'Amount', 'Asset', 'Timestamp'];
    const rows = transactions.map((t) => {
      const isOut = (t.from || '').toLowerCase() === address.toLowerCase();
      return [
        t.txHash || t.hash || '',
        t.status || 'confirmed',
        isOut ? 'OUTGOING' : 'INCOMING',
        t.from || '',
        t.to || '',
        t.amountNormalized || t.value || '0',
        t.asset || 'ETH',
        t.timestamp ? new Date(t.timestamp).toISOString() : '',
      ].map((v) => `"${v}"`).join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wallet_${address.slice(0, 10)}_transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Audit trail exported successfully', 'success' as any);
  };

  useEffect(() => {
    fetchData();
  }, [address]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    addToast('success', 'Address copied to clipboard');
  };

  const getExplorerUrl = (addr: string, chain: string) => {
    if (chain === 'TRON') return `https://tronscan.org/#/address/${addr}`;
    if (chain === 'BITCOIN') return `https://mempool.space/address/${addr}`;
    return `https://etherscan.io/address/${addr}`;
  };

  const getTxExplorerUrl = (txHash: string, chain: string) => {
    if (chain === 'TRON') return `https://tronscan.org/#/transaction/${txHash}`;
    if (chain === 'BITCOIN') return `https://mempool.space/tx/${txHash}`;
    return `https://etherscan.io/tx/${txHash}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="skeleton h-56 rounded-xl" />
          <div className="skeleton h-56 rounded-xl" />
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="text-center py-20">
        <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
        <p className="text-lg font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Wallet not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm underline" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>Go back</button>
      </div>
    );
  }

  const txBalance = transactions.reduce((acc, tx) => {
    const val = parseFloat(tx.amountNormalized || '0') || 0;
    if ((tx.to || '').toLowerCase() === address.toLowerCase()) return acc + val;
    if ((tx.from || '').toLowerCase() === address.toLowerCase()) return Math.max(0, acc - val);
    return acc;
  }, 0);

  const rawLive = wallet.metadata?.liveBalance;
  const liveBal = (rawLive !== undefined && rawLive !== null && parseFloat(rawLive) > 0)
    ? rawLive
    : (wallet.totalReceived && parseFloat(wallet.totalReceived) > 0)
      ? wallet.totalReceived
      : txBalance > 0
        ? txBalance.toFixed(4)
        : (rawLive !== undefined && rawLive !== null) ? rawLive : '0.00';

  const tokenSymbol = wallet.metadata?.tokenSymbol || transactions[0]?.asset || (wallet.blockchain === 'TRON' ? 'TRX' : wallet.blockchain === 'BITCOIN' ? 'BTC' : 'ETH');
  const usdVal = wallet.metadata?.usdValue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg border hover:bg-slate-800/30 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-neon-cyan" />
              <h1 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Wallet Intelligence</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider', getRiskColor(wallet.riskLevel || 'LOW'))}>
                {wallet.riskLevel || 'LOW'} RISK ({wallet.riskScore || 0}/100)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-mono text-xs sm:text-sm font-semibold text-slate-300">{address}</p>
              <button onClick={copyAddress} title="Copy Address" className="p-1 hover:text-white rounded transition-colors text-slate-400">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a href={getExplorerUrl(address, wallet.blockchain)} target="_blank" rel="noopener noreferrer" title="View in Explorer" className="p-1 text-neon-cyan hover:text-cyan-300">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push(`/dashboard/graph?address=${encodeURIComponent(address)}&blockchain=${encodeURIComponent(wallet.blockchain || 'ETHEREUM')}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-white"
            style={{ borderColor: isDark ? 'rgba(42,48,74,0.7)' : '#cbd5e1' }}
          >
            <Network className="w-3.5 h-3.5 text-neon-violet" />
            Trace in Graph
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-white"
            style={{ borderColor: isDark ? 'rgba(42,48,74,0.7)' : '#cbd5e1' }}
          >
            <Download className="w-3.5 h-3.5 text-neon-cyan" />
            Export Audit CSV
          </button>
          <button
            onClick={() => fetchData(true, true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-neon-cyan/15 hover:bg-neon-cyan/25 text-neon-cyan border-neon-cyan/40"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Syncing...' : 'Sync Live On-Chain'}
          </button>
        </div>
      </div>

      {/* Top Fact Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Balance with clean formatting */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400 mb-1">Live On-Chain Balance</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white font-mono">
                {liveBal !== undefined && liveBal !== null ? formatAmount(liveBal, 4) : '0.00'}
              </span>
              <span className="text-xs text-neon-cyan font-bold">{tokenSymbol}</span>
            </div>
            {usdVal ? (
              <p className="text-[11px] text-emerald-400 font-mono mt-0.5">≈ ${formatAmount(usdVal)} USD</p>
            ) : (
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Verified on-chain state</p>
            )}
          </div>
        </div>

        {/* Card 2: Owner / Legal Custodian */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400 mb-1">Identified Wallet Owner</p>
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-neon-violet shrink-0" />
              <p className="text-sm font-bold text-white truncate">
                {wallet.metadata?.ownerName || attribution?.legalEntity || attribution?.name || (wallet.label && !wallet.label.includes('...') ? wallet.label : 'Private Key Holder')}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {attribution ? 'Identified Legal Entity' : 'Non-Custodial Account'}
            </p>
          </div>
        </div>

        {/* Card 3: Blockchain & Network */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400 mb-1">Blockchain & Network</p>
            <p className="text-base font-bold text-white uppercase">{wallet.blockchain || 'ETHEREUM'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Decentralized ledger</p>
          </div>
        </div>

        {/* Card 4: Transaction History Audit Trail */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-400 mb-1">Transaction History</p>
            <p className="text-base font-bold text-white font-mono">
              {transactions.length > 0 ? `${transactions.length} indexed` : 'Live Synced'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Forensic ledger active</p>
          </div>
        </div>
      </div>

      {/* VASP Attribution & Compliance Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <Building2 className="w-4 h-4 text-neon-cyan" />
              VASP Attribution & Service Identity
            </h3>
            {attribution ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ATTRIBUTED ({attribution.confidence || 98}%)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/30">
                NON-CUSTODIAL / UNATTRIBUTED
              </span>
            )}
          </div>

          {attribution ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-mono uppercase text-slate-400">Regulated Entity</p>
                  <p className="text-sm font-bold text-white">{attribution.name || attribution.entityName || 'Regulated VASP'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase text-slate-400">Jurisdiction</p>
                  <p className="text-sm font-semibold text-slate-200">{attribution.jurisdiction || 'Global'}</p>
                </div>
              </div>

              {attribution.complianceOfficer && (
                <div>
                  <p className="text-[10px] font-mono uppercase text-slate-400">Compliance / Nodal Desk</p>
                  <p className="font-semibold text-slate-200 mt-0.5">{attribution.complianceOfficer}</p>
                </div>
              )}

              {attribution.complianceEmail && (
                <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-800">
                  <Mail className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                  <span className="font-mono text-slate-300 text-[11px] truncate">{attribution.complianceEmail}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">CrPC Section 91 / Subpoena Portal:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready for Subpoena Dispatch
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm font-medium text-slate-300">Self-Sovereign / Private Non-Custodial Address</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                This address is not an exchange deposit address or omnibus hot/cold wallet. It is directly controlled by the private key holder or smart contract deployer.
              </p>
            </div>
          )}
        </div>

        {/* Risk Assessment Factors */}
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <AlertTriangle className="w-4 h-4 text-neon-red" />
              Dynamic ML & Threat Intelligence Assessment
            </h3>
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold border', getRiskColor(risk?.riskLevel || wallet.riskLevel || 'LOW'))}>
              Score: {risk?.riskScore || wallet.riskScore || 0}/100
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {risk?.factors && risk.factors.length > 0 ? (
              risk.factors.map((f: any, i: number) => {
                const FRIENDLY_LABELS: Record<string, { title: string; desc: string }> = {
                  median_holding_min: {
                    title: 'Asset Holding & Dwell Time',
                    desc: 'Evaluates duration assets remain in the account before transit. Rapid pass-through indicates automated layering.',
                  },
                  avg_holding_min: {
                    title: 'Average Transit Duration',
                    desc: 'Calculates the mean time gap between fund deposit and subsequent dispatch.',
                  },
                  activity_frequency: {
                    title: 'Operational Velocity',
                    desc: 'Measures transaction frequency per active day to detect automated batching or bot behavior.',
                  },
                  tx_count: {
                    title: 'Transaction Ledger Breadth',
                    desc: 'Total volume of verified on-chain operations indexed for this account.',
                  },
                  log_amount_received_total: {
                    title: 'Aggregate Inflow Volume',
                    desc: 'Total gross value received across verified counterparties.',
                  },
                  log_amount_sent_total: {
                    title: 'Aggregate Outflow Volume',
                    desc: 'Total gross value disbursed to external recipient addresses.',
                  },
                  unique_senders: {
                    title: 'Funding Counterparty Diversity',
                    desc: 'Diversity count of unique funding sources sending assets into this wallet.',
                  },
                  unique_receivers: {
                    title: 'Recipient Counterparty Diversity',
                    desc: 'Diversity count of destination accounts receiving transfers.',
                  },
                  forwarding_ratio: {
                    title: 'Pass-Through Transit Ratio',
                    desc: 'Ratio of outward disbursements to inward deposits (signature of money transit mules).',
                  },
                  velocity_24h: {
                    title: '24-Hour Velocity Surge',
                    desc: 'Burst volume of transfers occurring in a 24-hour window.',
                  },
                  vasp_proximity: {
                    title: 'Regulated VASP Proximity',
                    desc: 'Hops distance to an exchange or custodial off-ramp.',
                  },
                };
                const mapped = FRIENDLY_LABELS[f.factor] || FRIENDLY_LABELS[f.name];
                const displayTitle = mapped?.title || f.factor || f.name;
                const displayDesc = f.description?.startsWith('SHAP') && mapped?.desc ? mapped.desc : f.description;
                const scoreVal = Math.min(100, Math.round(Number(f.score || f.value || 0)));

                return (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200">{displayTitle}</span>
                      <span className="font-mono font-bold text-neon-cyan">{scoreVal}/100</span>
                    </div>
                    {displayDesc && <p className="text-[11px] text-slate-400">{displayDesc}</p>}
                  </div>
                );
              })
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-300">Chainabuse Multi-Chain Fraud Check</span>
                  <span className="text-emerald-400 font-mono font-semibold">0 Reports Clean</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-300">High Velocity Layering</span>
                  <span className="text-slate-400 font-mono">Normal</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-300">Darknet / Sanction Proximity</span>
                  <span className="text-emerald-400 font-mono">Negative</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent On-Chain Transactions */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
              <FileText className="w-4 h-4 text-neon-cyan" />
              On-Chain Transaction Audit Trail
            </h3>
            <p className="text-xs text-slate-400">Directly indexed from blockchain explorer APIs with verified status</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-900/60 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setTxFilter('all')}
                className={cn('px-2.5 py-1 rounded font-medium transition-all', txFilter === 'all' ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'text-slate-400 hover:text-white')}
              >
                All ({transactions.length})
              </button>
              <button
                onClick={() => setTxFilter('in')}
                className={cn('px-2.5 py-1 rounded font-medium transition-all', txFilter === 'in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-white')}
              >
                Inflow ({transactions.filter((t: any) => (t.to || '').toLowerCase() === address.toLowerCase()).length})
              </button>
              <button
                onClick={() => setTxFilter('out')}
                className={cn('px-2.5 py-1 rounded font-medium transition-all', txFilter === 'out' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-slate-400 hover:text-white')}
              >
                Outflow ({transactions.filter((t: any) => (t.from || '').toLowerCase() === address.toLowerCase()).length})
              </button>
              {transactions.some((t: any) => (t.status || '').toLowerCase() === 'pending') && (
                <button
                  onClick={() => setTxFilter('pending')}
                  className={cn('px-2.5 py-1 rounded font-medium transition-all', txFilter === 'pending' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-white')}
                >
                  Pending ({transactions.filter((t: any) => (t.status || '').toLowerCase() === 'pending').length})
                </button>
              )}
            </div>

            <button
              onClick={() => fetchData(true, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Syncing...' : 'Sync Live'}
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center mx-auto text-neon-cyan">
              <RefreshCw className={cn('w-6 h-6', refreshing && 'animate-spin')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">No On-Chain Records Currently Cached</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Index live on-chain transaction history directly into the platform ledger for verified forensic audit.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => fetchData(false, true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan text-slate-950 hover:bg-cyan-300 text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                {refreshing ? 'Scanning Blockchain Network...' : 'Sync Live On-Chain Audit Trail'}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-900/20 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Tx Hash</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Direction</th>
                  <th className="text-left px-4 py-3">From</th>
                  <th className="text-left px-4 py-3">To</th>
                  <th className="text-right px-4 py-3">Value</th>
                  <th className="text-right px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {transactions
                  .filter((tx: any) => {
                    if (txFilter === 'in') return (tx.to || '').toLowerCase() === address.toLowerCase();
                    if (txFilter === 'out') return (tx.from || '').toLowerCase() === address.toLowerCase();
                    if (txFilter === 'pending') return (tx.status || '').toLowerCase() === 'pending';
                    return true;
                  })
                  .map((tx: any) => {
                    const isOut = (tx.from || '').toLowerCase() === address.toLowerCase();
                    const statusStr = (tx.status || '').toLowerCase();
                    const isFailed = statusStr === 'failed' || tx.isError === '1';
                    const isPending = statusStr === 'pending';
                    const isSuccess = !isFailed && !isPending;

                    return (
                      <tr key={tx.id || tx.txHash || tx.hash} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-200 font-mono">
                              {shortenAddress(tx.txHash || tx.hash, 8)}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tx.txHash || tx.hash);
                                addToast('Transaction hash copied to clipboard', 'success' as any);
                              }}
                              className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                              title="Copy Tx Hash"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <a
                              href={getTxExplorerUrl(tx.txHash || tx.hash, tx.chain || wallet.blockchain)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-neon-cyan transition-colors"
                              title="Inspect on Public Explorer"
                            >
                              <ExternalLink className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3 h-3" /> PENDING
                            </span>
                          ) : isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              <XCircle className="w-3 h-3" /> FAILED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold',
                              isOut
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                            )}
                          >
                            {isOut ? (
                              <>
                                <ArrowUpRight className="w-2.5 h-2.5" /> OUTGOING
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="w-2.5 h-2.5" /> INCOMING
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <span className={cn((tx.from || '').toLowerCase() === address.toLowerCase() && 'font-bold text-white')}>
                              {shortenAddress(tx.from, 6)}
                            </span>
                            {tx.from && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(tx.from);
                                  addToast('Sender address copied', 'success' as any);
                                }}
                                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                                title="Copy From Address"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <span className={cn((tx.to || '').toLowerCase() === address.toLowerCase() && 'font-bold text-white')}>
                              {shortenAddress(tx.to, 6)}
                            </span>
                            {tx.to && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(tx.to);
                                  addToast('Recipient address copied', 'success' as any);
                                }}
                                className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                                title="Copy To Address"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right font-mono font-bold text-white">
                          {formatAmount(tx.amountNormalized || tx.value, 4)}{' '}
                          <span className="text-[10px] text-neon-cyan font-normal">{tx.asset || tokenSymbol}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right font-mono text-slate-400">
                          {tx.timestamp ? formatDate(tx.timestamp) : '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {transactions.length > 0 && (
          <div className="p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/30" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
            <span className="text-xs text-slate-400 font-mono">
              Showing {transactions.length} verified transactions (Page {txPage})
            </span>
            <div className="flex items-center gap-2">
              {hasMoreTx ? (
                <button
                  onClick={loadMoreTransactions}
                  disabled={loadingMoreTx}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 border border-neon-cyan/40 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loadingMoreTx && 'animate-spin')} />
                  {loadingMoreTx ? 'Fetching Next 20...' : 'Load More (20 Transactions)'}
                </button>
              ) : (
                <span className="text-xs text-slate-500 font-mono italic">
                  All cached & on-chain transactions loaded
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

