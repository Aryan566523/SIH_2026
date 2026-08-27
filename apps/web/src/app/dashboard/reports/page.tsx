'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Shield, Clock, RefreshCw } from 'lucide-react';
import { reportsApi, casesApi } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import { formatDate } from '@/lib/utils';

export default function ReportsPage() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [caseId, setCaseId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useUIStore();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const cases = await casesApi.list({ limit: 50 });
      const caseList = cases.data.data || [];
      const allReports: any[] = [];
      for (const c of caseList.slice(0, 10)) {
        try {
          const { data } = await reportsApi.getByCase(c.id);
          if (data.data) allReports.push(...(Array.isArray(data.data) ? data.data : [data.data]));
        } catch { /* ignore */ }
      }
      setReports(allReports);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!caseId) return;
    setGenerating(true);
    try {
      const { data } = await reportsApi.generate(caseId);
      setResult(data.data);
      addToast('success', 'Report generated successfully');
      fetchReports();
    } catch {
      addToast('error', 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const { data } = await reportsApi.verify(id);
      addToast(data.data.valid ? 'success' : 'warning',
        data.data.valid ? 'Report integrity verified' : 'Report integrity check FAILED');
    } catch {
      addToast('error', 'Verification failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
          <FileText className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
          Investigation Reports
        </h1>
        <button onClick={fetchReports} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Generate report */}
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: isDark ? '#ffffff' : '#101318' }}>Generate Report</h3>
        <div className="flex items-center gap-4">
          <input
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="Enter Case ID"
            className="flex-1 px-4 py-2 rounded-lg text-sm font-mono outline-none"
            style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
          />
          <button onClick={handleGenerate} disabled={generating || !caseId} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50" style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}>
            {generating ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: isDark ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 150, 180, 0.3)', borderTopColor: isDark ? '#00f0ff' : '#0891b2' }} /> : <FileText className="w-4 h-4" />}
            Generate PDF
          </button>
        </div>
      </div>

      {/* Latest result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6 border" style={{ borderColor: isDark ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 200, 100, 0.2)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{result.title}</h3>
              <p className="text-xs mt-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Generated: {formatDate(result.createdAt)} • Version: {result.version}</p>
              <p className="text-xs mt-1 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>SHA-256: {result.sha256Hash?.substring(0, 32)}...</p>
              <div className="flex gap-2 mt-2">
                {result.sections?.map((s: string) => (
                  <span key={s} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}` }}>
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleVerify(result.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all" style={{ color: isDark ? '#00ff88' : '#10b981', border: `1px solid ${isDark ? 'rgba(0, 255, 136, 0.3)' : 'rgba(0, 185, 100, 0.3)'}` }}>
                <Shield className="w-3 h-3" /> Verify
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Existing reports list */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
          <h3 className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Generated Reports</h3>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded" />)}</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
            <p className="text-sm" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>No reports generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-3 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Title</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Version</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Generated</th>
                  <th className="text-right px-4 py-3 text-[10px] font-medium uppercase" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report: any) => (
                  <tr key={report.id} className="border-b" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-3" style={{ color: isDark ? '#ffffff' : '#101318' }}>{report.title}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{report.version}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{report.createdAt ? formatDate(report.createdAt) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleVerify(report.id)} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                        <Shield className="w-3 h-3 inline mr-1" />Verify
                      </button>
                    </td>
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
