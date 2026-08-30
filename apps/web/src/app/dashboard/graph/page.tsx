'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui.store';
import { useThemeStore } from '@/lib/stores/theme.store';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Edge,
  Node,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '@/lib/api';

// ── Node type configuration ──────────────────────────────────────────────────
const NODE_CONFIG: Record<string, { bg: string; border: string; label: string }> = {
  suspect:  { bg: '#ff4d4f', border: '#ff1f23', label: 'SUSPECT' },
  exchange: { bg: '#7c3aed', border: '#6d28d9', label: 'EXCHANGE' },
  vasp:     { bg: '#7c3aed', border: '#6d28d9', label: 'VASP' },
  mixer:    { bg: '#f97316', border: '#ea580c', label: 'MIXER' },
  bridge:   { bg: '#0891b2', border: '#0e7490', label: 'BRIDGE' },
  dex:      { bg: '#059669', border: '#047857', label: 'DEX' },
  high_risk:{ bg: '#dc2626', border: '#b91c1c', label: 'HIGH RISK' },
  wallet:   { bg: '#1e293b', border: '#334155', label: 'WALLET' },
  default:  { bg: '#1e293b', border: '#334155', label: 'WALLET' },
};

// ── Custom Node Component ─────────────────────────────────────────────────────
function WalletNode({ data }: NodeProps) {
  const cfg = NODE_CONFIG[data.nodeType] || NODE_CONFIG.default;
  const isSuspect = data.nodeType === 'suspect';
  return (
    <div
      style={{
        background: cfg.bg,
        border: `2px solid ${cfg.border}`,
        borderRadius: 8,
        padding: '8px 14px',
        minWidth: 130,
        maxWidth: 180,
        textAlign: 'center',
        boxShadow: isSuspect ? `0 0 16px ${cfg.bg}88` : '0 2px 8px rgba(0,0,0,0.4)',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: cfg.border }} />
      <div style={{ fontSize: 9, color: '#fff8', fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>
        {cfg.label}
      </div>
      <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, wordBreak: 'break-all' }}>
        {data.label}
      </div>
      {data.address && !data.label.includes('...') && data.address !== data.label && (
        <div style={{ fontSize: 9, color: '#ffffff99', marginTop: 2, fontFamily: 'monospace' }}>
          {`${data.address.slice(0, 6)}...${data.address.slice(-4)}`}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: cfg.border }} />
    </div>
  );
}

const nodeTypes = { walletNode: WalletNode };

// ── Hierarchical layout: BFS left→right ─────────────────────────────────────
function computeLayout(
  rawNodes: any[],
  rawEdges: any[],
  suspectAddress: string,
): { nodes: Node[]; edges: Edge[] } {
  const NODE_W = 190;
  const NODE_H = 70;
  const H_GAP = 220;
  const V_GAP = 90;

  // BFS to assign columns (depths)
  const depthMap = new Map<string, number>();
  const queue: string[] = [suspectAddress.toLowerCase()];
  depthMap.set(suspectAddress.toLowerCase(), 0);

  const adjOut = new Map<string, Set<string>>();
  const adjIn  = new Map<string, Set<string>>();
  for (const e of rawEdges) {
    if (!adjOut.has(e.source)) adjOut.set(e.source, new Set());
    if (!adjIn.has(e.target))  adjIn.set(e.target, new Set());
    adjOut.get(e.source)!.add(e.target);
    adjIn.get(e.target)!.add(e.source);
  }

  // Forward BFS
  while (queue.length) {
    const cur = queue.shift()!;
    const curDepth = depthMap.get(cur) ?? 0;
    for (const nxt of adjOut.get(cur) ?? []) {
      if (!depthMap.has(nxt)) {
        depthMap.set(nxt, curDepth + 1);
        queue.push(nxt);
      }
    }
  }
  // Backward BFS for nodes that feed INTO the suspect
  const backQueue: string[] = [suspectAddress.toLowerCase()];
  const backVisited = new Set([suspectAddress.toLowerCase()]);
  while (backQueue.length) {
    const cur = backQueue.shift()!;
    const curDepth = depthMap.get(cur) ?? 0;
    for (const prev of adjIn.get(cur) ?? []) {
      if (!depthMap.has(prev)) {
        depthMap.set(prev, curDepth - 1);
        if (!backVisited.has(prev)) { backQueue.push(prev); backVisited.add(prev); }
      }
    }
  }

  // Group nodes by depth column
  const columns = new Map<number, string[]>();
  for (const n of rawNodes) {
    const d = depthMap.get(n.id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n.id);
  }
  // Also add nodes not reachable from suspect (orphans → depth 999)
  for (const n of rawNodes) {
    if (!depthMap.has(n.id)) {
      depthMap.set(n.id, 999);
      if (!columns.has(999)) columns.set(999, []);
      columns.get(999)!.push(n.id);
    }
  }

  // Assign pixel positions
  const posMap = new Map<string, { x: number; y: number }>();
  const sortedDepths = Array.from(columns.keys()).sort((a, b) => a - b);
  sortedDepths.forEach((depth, colIdx) => {
    const col = columns.get(depth)!;
    col.forEach((id, rowIdx) => {
      posMap.set(id, {
        x: colIdx * H_GAP,
        y: rowIdx * V_GAP - ((col.length - 1) * V_GAP) / 2,
      });
    });
  });

  const nodeMap = new Map(rawNodes.map((n: any) => [n.id, n]));

  const nodes: Node[] = rawNodes.map((n: any) => ({
    id: n.id,
    type: 'walletNode',
    position: posMap.get(n.id) ?? { x: 0, y: 0 },
    data: {
      label: n.label || `${n.id.slice(0, 6)}...${n.id.slice(-4)}`,
      address: n.address || n.id,
      nodeType: n.type || 'wallet',
    },
  }));

  const edges: Edge[] = rawEdges.map((e: any, i: number) => ({
    id: `e-${i}-${e.txHash || i}`,
    source: e.source,
    target: e.target,
    animated: true,
    label: e.amount && e.token ? `${parseFloat(e.amount).toFixed(3)} ${e.token}` : undefined,
    labelStyle: { fill: '#94a3b8', fontSize: 10 },
    style: { stroke: '#475569', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
  }));

  return { nodes, edges };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GraphPage() {
  const [address, setAddress] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ txCount: number; dataSource: string; provider: string } | null>(null);
  const { addToast } = useUIStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const buildGraph = useCallback(async () => {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setInfo(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/graph/trace?address=${encodeURIComponent(addr)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.nodes?.length) {
        addToast('No transactions found for this address. Run an investigation first to populate the database.', 'warning' as any);
        setNodes([]);
        setEdges([]);
        return;
      }

      const { nodes: ln, edges: le } = computeLayout(data.nodes, data.edges, addr);
      setNodes(ln);
      setEdges(le);
      setInfo({
        txCount: data.edges?.length ?? 0,
        dataSource: data.dataSource || 'DATABASE',
        provider: data.providerName || 'Postgres',
      });
      addToast(`Graph built: ${ln.length} wallets, ${le.length} transactions`, 'success' as any);
    } catch (err: any) {
      addToast(`Failed to build graph: ${err.message}`, 'error' as any);
    } finally {
      setLoading(false);
    }
  }, [address, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buildGraph();
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            Transaction Graph
          </h1>
          <p className="text-sm font-mono mt-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            Fund flow visualization — BFS hierarchical layout
          </p>
        </div>
        {info && (
          <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg"
            style={{ background: isDark ? '#1a1e2f' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b', border: '1px solid #2a304a' }}>
            <Info className="w-3 h-3" />
            {info.txCount} txs · Source: {info.dataSource} · via {info.provider}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 12 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter wallet address to trace (e.g. 0x28C6c06... or TXcRND...)"
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontFamily: 'monospace',
            background: isDark ? '#1a1e2f' : '#f8fafc',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            color: isDark ? '#ffffff' : '#101318',
            outline: 'none',
          }}
        />
        <button
          onClick={buildGraph}
          disabled={loading || !address.trim()}
          style={{
            padding: '10px 24px', borderRadius: 8, fontWeight: 700, fontSize: 13,
            background: loading ? '#334155' : '#00f0ff',
            color: '#000',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Tracing...' : 'Trace'}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(NODE_CONFIG).filter(([k]) => k !== 'default').map(([type, cfg]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.bg, border: `1px solid ${cfg.border}` }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Graph canvas */}
      <div style={{
        flex: 1, borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        background: isDark ? '#0b0f1a' : '#f8fafc',
      }}>
        {nodes.length === 0 ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <AlertTriangle className="w-12 h-12" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
            <p style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 14 }}>
              Enter a wallet address and click <strong>Trace</strong> to visualize the fund flow graph
            </p>
            <p style={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 12, fontFamily: 'monospace' }}>
              Tip: Run an investigation first to populate the database, or paste a known wallet like the Binance hot wallet
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color={isDark ? '#1e293b' : '#cbd5e1'} gap={24} />
            <Controls />
            <MiniMap
              nodeColor={(n) => NODE_CONFIG[n.data?.nodeType]?.bg || '#1e293b'}
              style={{ background: isDark ? '#0f172a' : '#f1f5f9' }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
