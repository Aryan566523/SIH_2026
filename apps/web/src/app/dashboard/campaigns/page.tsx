'use client';

import { useEffect, useState } from 'react';
import { FileWarning, AlertCircle } from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme.store';
import { fraudCampaignsApi } from '@/lib/api';

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
}

export default function CampaignsPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <FileWarning className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Fraud Campaigns
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
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Name</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Type</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Status</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Identified</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Wallets</th>
                  <th className="p-4 font-medium text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Value (USD)</th>
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
                    <tr key={c.id} style={{ borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, color: isDark ? '#e2e8f0' : '#1e293b' }} className="hover:bg-slate-500/5 transition-colors">
                      <td className="p-4 text-sm font-medium">{c.name}</td>
                      <td className="p-4 text-sm">{c.type}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'Active' ? 'bg-red-500/10 text-red-500' :
                          c.status === 'Investigating' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{new Date(c.identifiedDate).toLocaleDateString()}</td>
                      <td className="p-4 text-sm">{c.associatedWallets}</td>
                      <td className="p-4 text-sm">${c.estimatedTotalValue.toLocaleString()}</td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${c.riskScore}%`,
                                backgroundColor: c.riskScore > 80 ? '#ef4444' : c.riskScore > 50 ? '#f59e0b' : '#10b981'
                              }}
                            />
                          </div>
                          <span className="text-xs">{c.riskScore}</span>
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
    </div>
  );
}
