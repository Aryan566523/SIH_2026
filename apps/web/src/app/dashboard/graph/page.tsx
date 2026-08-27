'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Network, Search, ZoomIn, ZoomOut, Maximize, Filter } from 'lucide-react';
import { graphApi } from '@/lib/api';
import { useUIStore } from '@/lib/stores/ui.store';
import { useThemeStore } from '@/lib/stores/theme.store';

export default function GraphPage() {
  const [address, setAddress] = useState('');
  const [blockchain, setBlockchain] = useState('ETHEREUM');
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useUIStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const buildGraph = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const { data } = await graphApi.build(address, blockchain, 3);
      setGraphData(data.data);
      addToast('success', `Graph built: ${data.data.nodes.length} nodes, ${data.data.edges.length} edges`);
    } catch (error: any) {
      addToast('error', 'Failed to build graph');
    } finally {
      setLoading(false);
    }
  };

  const nodeColors: Record<string, string> = {
    suspect: '#ef4444',
    victim: '#f59e0b',
    wallet: '#6366f1',
    burner: '#f97316',
    exchange: '#10b981',
    vasp: '#10b981',
    dex: '#8b5cf6',
    bridge: '#06b6d4',
    mixer: '#ec4899',
    high_risk: '#ef4444',
    unknown: '#64748b',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#101318' }}>
        <Network className="w-6 h-6" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
        Transaction Graph
      </h1>

      {/* Controls */}
      <div className="glass-panel rounded-xl p-4 flex items-center gap-4">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter wallet address to visualize..."
          className="flex-1 px-4 py-2 rounded-lg text-sm font-mono outline-none"
          style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
        />
        <select
          value={blockchain}
          onChange={(e) => setBlockchain(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', border: `1px solid ${isDark ? '#2a304a' : '#e2e8f0'}`, color: isDark ? '#ffffff' : '#101318' }}
        >
          <option value="ETHEREUM">Ethereum</option>
          <option value="BITCOIN">Bitcoin</option>
          <option value="TRON">Tron</option>
        </select>
        <button
          onClick={buildGraph}
          disabled={loading || !address}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.1)', border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.3)', color: isDark ? '#00f0ff' : '#0891b2' }}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Build Graph
        </button>
      </div>

      {/* Graph visualization */}
      <div className="glass-panel rounded-xl overflow-hidden" style={{ height: '600px' }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
              <p className="text-sm font-mono" style={{ color: isDark ? 'rgba(0, 240, 255, 0.6)' : 'rgba(8, 145, 178, 0.6)' }}>Building transaction graph...</p>
            </div>
          </div>
        ) : !graphData ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Network className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
              <p className="mb-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Enter a wallet address to visualize fund flow</p>
              <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>The graph will show transaction relationships and fund movements</p>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {/* Simple node-edge visualization */}
            <svg className="w-full h-full" viewBox={`0 0 800 500`}>
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,240,255,0.05)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Edges */}
              {graphData.edges.map((edge: any, i: number) => {
                const sourceNode = graphData.nodes.find((n: any) => n.id === edge.source);
                const targetNode = graphData.nodes.find((n: any) => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sourceIdx = graphData.nodes.indexOf(sourceNode);
                const targetIdx = graphData.nodes.indexOf(targetNode);
                const x1 = 80 + (sourceIdx % 8) * 90;
                const y1 = 60 + Math.floor(sourceIdx / 8) * 80;
                const x2 = 80 + (targetIdx % 8) * 90;
                const y2 = 60 + Math.floor(targetIdx / 8) * 80;

                return (
                  <line
                    key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(0,240,255,0.3)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  >
                    <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
                  </line>
                );
              })}

              {/* Nodes */}
              {graphData.nodes.map((node: any, i: number) => {
                const x = 80 + (i % 8) * 90;
                const y = 60 + Math.floor(i / 8) * 80;
                const color = nodeColors[node.type] || nodeColors.unknown;
                const isOrigin = node.id === address;

                return (
                  <g key={node.id}>
                    {isOrigin && (
                      <circle cx={x} cy={y} r="22" fill="none" stroke={color} strokeWidth="1" opacity="0.3">
                        <animate attributeName="r" values="18;24;18" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={x} cy={y} r={isOrigin ? 16 : 10}
                      fill={color}
                      opacity="0.2"
                      stroke={color}
                      strokeWidth="1.5"
                    />
                    <circle cx={x} cy={y} r={isOrigin ? 6 : 3} fill={color} />
                    <text
                      x={x} y={y + (isOrigin ? 26 : 18)}
                      textAnchor="middle"
                      fill="rgba(226,232,240,0.6)"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {node.address ? `${node.address.substring(0, 6)}...${node.address.slice(-4)}` : node.label}
                    </text>
                    <text
                      x={x} y={y - (isOrigin ? 22 : 14)}
                      textAnchor="middle"
                      fill={color}
                      fontSize="7"
                      fontFamily="monospace"
                      opacity="0.6"
                    >
                      {node.type?.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 glass-panel rounded-lg p-3">
              <p className="text-[10px] font-mono mb-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>NODE TYPES</p>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {Object.entries(nodeColors).slice(0, 8).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="capitalize" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{type.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="absolute top-4 right-4 glass-panel rounded-lg p-3 text-right">
              <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{graphData.nodes.length}</span> nodes
                {' • '}
                <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>{graphData.edges.length}</span> edges
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
