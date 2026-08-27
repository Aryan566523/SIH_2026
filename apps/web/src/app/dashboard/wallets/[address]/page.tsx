'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, ExternalLink, AlertTriangle, MapPin, Copy } from 'lucide-react';
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

  useEffect(() => {
    if (!address) return;
    const fetchData = async () => {
      try {
        const [walletRes, riskRes, attrRes, txRes] = await Promise.allSettled([
          walletsApi.get(address),
          walletsApi.getRisk(address),
          walletsApi.getAttribution(address),
          walletsApi.getTransactions(address, { limit: 20 }),
        ]);
        if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data.data);
        if (riskRes.status === 'fulfilled') setRisk(riskRes.value.data.data);
        if (attrRes.status === 'fulfilled') setAttribution(attrRes.value.data.data);
        if (txRes.status === 'fulfilled') setTransactions(txRes.value.data.data || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, [address]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    addToast('success', 'Address copied');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="text-center py-20">
        <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
        <p className="text-lg font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Wallet not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg transition-colors" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <Shield className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
            Wallet Intelligence
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-mono text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{shortenAddress(address, 12)}</p>
            <button onClick={copyAddress} className="p-1 rounded transition-colors" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
        {wallet.riskLevel && (
          <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', getRiskColor(wallet.riskLevel))}>
            Risk: {wallet.riskScore || 0}
          </span>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Blockchain', value: wallet.blockchain || 'Unknown' },
          { label: 'Risk Score', value: wallet.riskScore || 'N/A' },
          { label: 'Risk Level', value: wallet.riskLevel || 'Unknown' },
          { label: 'Label', value: wallet.label || wallet.entityLabel || 'Unattributed' },
        ].map((item) => (
          <div key={item.label} className="glass-panel rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase mb-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{item.label}</p>
            <p className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Attribution */}
      {attribution && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <MapPin className="w-4 h-4" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} /> VASP Attribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Entity</p><p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{attribution.name || attribution.entityName || '-'}</p></div>
            <div><p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Type</p><p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{attribution.type || '-'}</p></div>
            <div><p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Confidence</p><p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{attribution.confidence || '-'}%</p></div>
            <div><p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Jurisdiction</p><p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{attribution.jurisdiction || '-'}</p></div>
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      {risk && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} /> Risk Assessment
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Score</p><p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{risk.riskScore || '-'}/100</p></div>
            <div><p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Level</p><p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#101318' }}>{risk.riskLevel || '-'}</p></div>
          </div>
          {risk.factors && risk.factors.length > 0 && (
            <div className="mt-4 space-y-2">
              {risk.factors.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: isDark ? 'rgba(42,48,74,0.3)' : 'rgba(0,0,0,0.04)' }}>
                  <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{f.factor || f.name}</span>
                  <span className="font-mono" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{f.score || f.value}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
          <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Recent Transactions</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="p-12 text-center"><p className="text-sm" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>No transactions found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Hash</th>
                  <th className="text-left px-4 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>From</th>
                  <th className="text-left px-4 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>To</th>
                  <th className="text-right px-4 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Amount</th>
                  <th className="text-right px-4 py-2 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id || tx.txHash} className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>{shortenAddress(tx.txHash, 8)}</td>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{shortenAddress(tx.from, 6)}</td>
                    <td className="px-4 py-2 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{shortenAddress(tx.to, 6)}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono" style={{ color: isDark ? '#ffffff' : '#101318' }}>{formatAmount(tx.amountNormalized)} {tx.asset}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{tx.timestamp ? formatDate(tx.timestamp) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
