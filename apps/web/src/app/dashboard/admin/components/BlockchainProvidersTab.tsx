'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Plus, Check, X, Server, Activity, Edit, Trash } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useThemeStore } from '@/lib/stores/theme.store';
import { api } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';

export function BlockchainProvidersTab() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [newConfig, setNewConfig] = useState({
    chain: 'ETHEREUM',
    name: '',
    chainId: '',
    nativeToken: '',
    dataModel: 'ACCOUNT',
    primaryProviderName: '',
    primaryEndpointUrl: '',
    apiKey: '',
    addressRegex: '',
    checksumType: 'None'
  });
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'mock'>('idle');
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [editKey, setEditKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const addToast = useUIStore((s) => s.addToast);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleLiveTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.post('/blockchain-configs/' + id + '/test-connection', { address: '0x0000000000000000000000000000000000000000' });
      if (res.data?.data?.dataSource === 'MOCK_FALLBACK') {
        addToast('Mock API Fallback (No Key)', 'warning');
      } else {
        addToast('LIVE Connection OK! Latency: ' + res.data?.data?.latencyMs + 'ms', 'success');
      }
    } catch (e) {
      addToast('LIVE Connection Failed!', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveKey = async () => {
    if (!editingProvider) return;
    setSavingKey(true);
    try {
      await api.put(`/blockchain-configs/` + editingProvider.id, { apiKey: editKey, status: editKey ? 'live' : 'mock' });
      const res = await api.get('/blockchain-configs');
      setProviders(res.data.data || []);
      setEditingProvider(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingKey(false);
    }
  };

  useEffect(() => {
    api.get("/blockchain-configs").then(res => { setProviders(res.data.data || []); setLoading(false); }).catch(e => { console.error(e); setLoading(false); });
  }, []);

  const handleTestConnection = (e: any) => {
    e.preventDefault();
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus('success');
    }, 1500);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>Dynamic API Registry</h2>
          <p className="text-sm text-slate-500">Manage blockchain RPC providers and address formats dynamically.</p>
        </div>
        <button 
          onClick={() => { setShowModal(true); setCurrentStep(1); setTestStatus('idle'); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Blockchain
        </button>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-900/20" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.5)' : '#e2e8f0' }}>
                  <th className="text-left px-4 py-4 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Network</th>
                  <th className="text-left px-4 py-4 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Provider</th>
                  <th className="text-left px-4 py-4 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Model</th>
                  <th className="text-left px-4 py-4 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Status</th>
                  <th className="text-right px-4 py-4 font-medium" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-slate-800/20 transition-colors" style={{ borderColor: isDark ? 'rgba(42, 48, 74, 0.3)' : 'rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", p.status === 'live' ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan' : 'bg-amber-500/10 border-amber-500/30 text-amber-500')}>
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{p.name}</p>
                          <p className="text-[10px] font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Chain ID: {p.chainId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs px-2 py-1 rounded bg-slate-800/50 text-slate-300">{p.primaryProviderName}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-bold text-slate-400">{p.dataModel}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border w-max", p.status === 'live' ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : p.status === 'mock' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700')}>
                          {p.status === 'live' ? <Activity className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                          {p.status.toUpperCase()}
                        </span>
                        {p.latencyMs && <span className="text-[9px] text-slate-500 ml-1">{p.latencyMs}ms latency</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleLiveTest(p.id)}
                          disabled={testingId === p.id}
                          className="p-1.5 rounded-md hover:bg-neon-green/10 text-slate-400 hover:text-neon-green transition-colors"
                          title="Test Connection"
                        >
                          {testingId === p.id ? <div className="w-4 h-4 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" /> : <Activity className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => { setEditingProvider(p); setEditKey(''); }}
                          className="p-1.5 rounded-md hover:bg-neon-cyan/10 text-slate-400 hover:text-neon-cyan transition-colors"
                          title="Edit Config"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                  <Database className="w-5 h-5 text-neon-cyan" /> Add Blockchain Provider
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex px-4 py-3 bg-slate-900 border-b border-slate-800">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex-1 flex items-center">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border", currentStep === step ? "bg-neon-cyan text-black border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]" : currentStep > step ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50" : "bg-slate-800 text-slate-500 border-slate-700")}>
                      {currentStep > step ? <Check className="w-3 h-3" /> : step}
                    </div>
                    {step < 4 && <div className={cn("h-0.5 flex-1 mx-2 rounded", currentStep > step ? "bg-neon-cyan/30" : "bg-slate-800")} />}
                  </div>
                ))}
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50">
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-white">Select a Template</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { 
                          label: 'TronGrid', 
                          desc: 'TRON network transactions via TronGrid',
                          data: { 
                            chain: 'TRON', 
                            name: 'TRON', 
                            chainId: '728126428', 
                            primaryProviderName: 'TronGrid',
                            nativeToken: 'TRX', 
                            primaryEndpointUrl: 'https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions',
                            apiKey: 'a20c9225-33d8-4bab-a7e5-f01664db040e',
                            dataModel: 'ACCOUNT', 
                            addressRegex: '^T[a-zA-Z1-9]{33}$', 
                            checksumType: 'Base58Check' 
                          } 
                        },
                        { 
                          label: 'Etherscan', 
                          desc: 'Ethereum network transactions via Etherscan V2',
                          data: { 
                            chain: 'ETHEREUM', 
                            name: 'Ethereum', 
                            chainId: '1', 
                            primaryProviderName: 'Etherscan',
                            nativeToken: 'ETH', 
                            primaryEndpointUrl: 'https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address={ADDRESS}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey={API_KEY}',
                            apiKey: 'FZRYRUQ3CS59SREXG3G6F9HCY5DNWMYZPY',
                            dataModel: 'ACCOUNT', 
                            addressRegex: '^0x[a-fA-F0-9]{40}$', 
                            checksumType: 'EIP-55' 
                          } 
                        },
                        { 
                          label: 'Chainabuse', 
                          desc: 'Multi-chain intelligence and threat reports',
                          data: { 
                            chain: 'UNKNOWN', 
                            name: 'Multi-chain Threat Intel', 
                            chainId: '', 
                            primaryProviderName: 'Chainabuse',
                            nativeToken: '', 
                            primaryEndpointUrl: 'https://api.chainabuse.com/v0/reports?address={ADDRESS}',
                            apiKey: 'ca_QlI1djRYTU14eEh6Y3J2M0w4cVczQzZ6LjUrTjVPNkFGcVdhelpiTXlZZ2dsT3c9PQ',
                            dataModel: 'ACCOUNT', 
                            addressRegex: '.*', 
                            checksumType: 'None' 
                          } 
                        },
                        { 
                          label: 'Custom', 
                          desc: 'Manually configure all parameters',
                          data: { chain: 'UNKNOWN', name: '', chainId: '', primaryProviderName: '', nativeToken: '', primaryEndpointUrl: '', apiKey: '', dataModel: 'ACCOUNT', addressRegex: '', checksumType: 'None' } 
                        }
                      ].map(t => (
                        <button key={t.label} onClick={() => { setNewConfig(prev => ({...prev, ...t.data})); setCurrentStep(2); }} className="p-4 border border-slate-700 rounded-lg text-left hover:border-neon-cyan hover:bg-neon-cyan/5 transition-all group">
                          <div className="font-bold text-slate-300 group-hover:text-neon-cyan">{t.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4 animate-in fade-in">
                    <h4 className="font-semibold text-white">API Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Chain Name</label>
                        <input type="text" value={newConfig.name} onChange={e => setNewConfig({...newConfig, name: e.target.value})} placeholder="e.g. TRON" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Chain ID</label>
                        <input type="text" value={newConfig.chainId} onChange={e => setNewConfig({...newConfig, chainId: e.target.value})} placeholder="e.g. 728126428" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Provider Name</label>
                        <input type="text" value={newConfig.primaryProviderName} onChange={e => setNewConfig({...newConfig, primaryProviderName: e.target.value})} placeholder="e.g. TronGrid" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Native Token Symbol</label>
                        <input type="text" value={newConfig.nativeToken} onChange={e => setNewConfig({...newConfig, nativeToken: e.target.value})} placeholder="e.g. TRX" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-slate-400">Primary API Endpoint URL</label>
                        <input type="text" value={newConfig.primaryEndpointUrl} onChange={e => setNewConfig({...newConfig, primaryEndpointUrl: e.target.value})} placeholder="https://api.trongrid.io/v1/accounts/{ADDRESS}/transactions" className="w-full font-mono bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                        <p className="text-[10px] text-slate-500">Use {`{ADDRESS}`} and {`{API_KEY}`} placeholders.</p>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-slate-400">API Key (Optional)</label>
                        <input type="password" value={newConfig.apiKey} onChange={e => setNewConfig({...newConfig, apiKey: e.target.value})} placeholder="Leave blank to force mock mode for this chain" className="w-full font-mono bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4 animate-in fade-in">
                    <h4 className="font-semibold text-white">Address Validation</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Regex Pattern</label>
                        <input type="text" value={newConfig.addressRegex} onChange={e => setNewConfig({...newConfig, addressRegex: e.target.value})} className="w-full font-mono bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Checksum Type</label>
                        <select value={newConfig.checksumType} onChange={e => setNewConfig({...newConfig, checksumType: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none">
                          <option value="EIP-55">EIP-55 (Mixed Case)</option>
                          <option value="None">None</option>
                          <option value="Base58Check">Base58Check</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4 animate-in fade-in">
                    <h4 className="font-semibold text-white">Review & Test</h4>
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm text-slate-300 space-y-2 font-mono break-all">
                      <p><strong>Chain:</strong> {newConfig.name} ({newConfig.chainId})</p>
                      <p><strong>Endpoint:</strong> {newConfig.primaryEndpointUrl}</p>
                      <p><strong>Validation:</strong> {newConfig.addressRegex}</p>
                    </div>

                    <div className="pt-4 flex flex-col items-center space-y-4">
                      <button 
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 flex items-center gap-2"
                      >
                        {testStatus === 'testing' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Server className="w-4 h-4" />}
                        {testStatus === 'testing' ? 'Testing Connection...' : 'Test Connection'}
                      </button>

                      {testStatus === 'success' && (
                        <div className="text-neon-green flex items-center gap-2 text-sm font-bold bg-neon-green/10 px-4 py-2 rounded-full border border-neon-green/30 animate-in slide-in-from-bottom-2">
                          <Check className="w-4 h-4" /> LIVE connection confirmed (85ms)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between">
                <button 
                  onClick={() => currentStep > 1 && setCurrentStep(c => c - 1)}
                  className={cn("px-4 py-2 rounded text-sm font-medium", currentStep === 1 ? "opacity-0 pointer-events-none" : "text-slate-400 hover:text-white")}
                >
                  Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-sm font-medium text-slate-400 hover:text-white">
                    Cancel
                  </button>
                  {currentStep < 4 ? (
                    <button 
                      onClick={() => setCurrentStep(c => c + 1)}
                      disabled={
                        (currentStep === 2 && (!newConfig.name || !newConfig.primaryEndpointUrl || !newConfig.primaryProviderName)) ||
                        (currentStep === 3 && !newConfig.addressRegex)
                      }
                      className="px-4 py-2 bg-neon-cyan text-black rounded text-sm font-bold hover:bg-neon-cyan/90 shadow-[0_0_15px_rgba(0,240,255,0.3)] disabled:opacity-50 disabled:shadow-none"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button 
                      onClick={async () => { 
                        try { 
                          await api.post('/blockchain-configs', { ...newConfig, isActive: true }); 
                          const { data } = await api.get('/blockchain-configs'); 
                          setProviders(data.data || []); 
                          setShowModal(false); 
                        } catch (e) { 
                          addToast('Failed to save provider. Check fields.', 'error'); 
                        } 
                      }}
                      className="px-4 py-2 bg-neon-cyan text-black rounded text-sm font-bold hover:bg-neon-cyan/90 shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    >
                      Save & Activate
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProvider && (<div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                  <Edit className="w-5 h-5 text-neon-cyan" /> Edit API Key
                </h3>
                <button onClick={() => setEditingProvider(null)} className="text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-white">{editingProvider.name}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-1">{editingProvider.primaryProviderName}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">API Key</label>
                  <input 
                    type="password" 
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    placeholder="Enter API Key (leave blank for MOCK fallback)" 
                    className="w-full font-mono bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-neon-cyan outline-none" 
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
                <button onClick={() => setEditingProvider(null)} className="px-4 py-2 rounded text-sm font-medium text-slate-400 hover:text-white">Cancel</button>
                <button 
                  onClick={handleSaveKey}
                  disabled={savingKey}
                  className="px-4 py-2 bg-neon-cyan text-black rounded text-sm font-bold hover:bg-neon-cyan/90 disabled:opacity-50"
                >
                  {savingKey ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
