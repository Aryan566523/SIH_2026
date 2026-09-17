'use client';

import { useState, useCallback, useMemo, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Info,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Wallet,
  ArrowRight,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  GitBranch,
  ArrowDownRight,
  Compass,
  Maximize2,
  Crosshair,
  Navigation,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';
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
  EdgeProps,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ── Node type configuration ──────────────────────────────────────────────────
const NODE_CONFIG: Record<string, { bg: string; border: string; label: string }> = {
  suspect:   { bg: '#ff4d4f', border: '#ff1f23', label: 'SUSPECT' },
  exchange:  { bg: '#7c3aed', border: '#6d28d9', label: 'EXCHANGE' },
  vasp:      { bg: '#7c3aed', border: '#6d28d9', label: 'VASP' },
  mixer:     { bg: '#f97316', border: '#ea580c', label: 'MIXER' },
  bridge:    { bg: '#0891b2', border: '#0e7490', label: 'BRIDGE' },
  dex:       { bg: '#059669', border: '#047857', label: 'DEX' },
  miner:     { bg: '#3b82f6', border: '#1d4ed8', label: 'MINER / VALIDATOR' },
  high_risk: { bg: '#dc2626', border: '#b91c1c', label: 'HIGH RISK' },
  wallet:    { bg: '#1e293b', border: '#334155', label: 'WALLET' },
  default:   { bg: '#1e293b', border: '#334155', label: 'WALLET' },
};

// ── Custom Node Component with Direct Money Transferred Badge ────────────────
function WalletNode({ data }: NodeProps) {
  const cfg = NODE_CONFIG[data.nodeType] || NODE_CONFIG.default;
  const isSuspect = data.nodeType === 'suspect' || data.isSuspect;
  const [copied, setCopied] = useState(false);

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const toCopy = data.address || data.label || '';
    if (toCopy) {
      navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const hasReceived = (data.receivedAmount || 0) > 0;
  const hasSent = (data.sentAmount || 0) > 0;

  return (
    <div
      style={{
        background: cfg.bg,
        border: `2px solid ${cfg.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 165,
        maxWidth: 220,
        textAlign: 'center',
        boxShadow: isSuspect ? `0 0 20px ${cfg.bg}aa` : '0 4px 14px rgba(0,0,0,0.5)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      className="hover:scale-105 hover:z-30"
    >
      <Handle type="target" position={Position.Left} style={{ background: cfg.border, width: 8, height: 8 }} />
      
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span style={{ fontSize: 9, color: '#fffa', fontWeight: 800, letterSpacing: 0.8 }}>
          {cfg.label}
        </span>
        <button
          onClick={onCopy}
          title="Copy address"
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: 'none',
            borderRadius: 4,
            padding: '2px 4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: copied ? '#4ade80' : '#ffffff',
          }}
          className="hover:bg-white/30 transition-colors"
        >
          {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.2 }}>
        {data.label}
      </div>

      {data.address && !data.label.includes('...') && data.address !== data.label && (
        <div style={{ fontSize: 9, color: '#ffffffaa', marginTop: 3, fontFamily: 'monospace' }}>
          {`${data.address.slice(0, 6)}...${data.address.slice(-4)}`}
        </div>
      )}

      {/* Prominently visible transferred money inside node card - NO lines can cross or block it */}
      {isSuspect && hasSent && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-black/45 border border-white/20 text-[10px] font-mono font-bold text-white flex items-center justify-center gap-1 shadow-sm"
          title={`Total Outflow: ${formatAmount(data.sentAmount, 6)} ${data.token || 'ETH'}`}
        >
          <ArrowUpRight className="w-3 h-3 text-red-300 flex-shrink-0" />
          <span className="truncate">Out: {formatAmount(data.sentAmount, 2)} {data.token || 'ETH'}</span>
        </div>
      )}

      {!isSuspect && hasReceived && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/60 text-[10px] font-mono font-bold text-emerald-300 flex items-center justify-center gap-1 shadow-sm"
          title={`Received: ${formatAmount(data.receivedAmount, 6)} ${data.token || 'USDT'}`}
        >
          <ArrowDownLeft className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <span className="truncate">+{formatAmount(data.receivedAmount, 4)} {data.token || 'USDT'}</span>
        </div>
      )}

      {!isSuspect && !hasReceived && hasSent && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/60 text-[10px] font-mono font-bold text-cyan-300 flex items-center justify-center gap-1 shadow-sm"
          title={`Sent: ${formatAmount(data.sentAmount, 6)} ${data.token || 'ETH'}`}
        >
          <ArrowUpRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span className="truncate">-{formatAmount(data.sentAmount, 4)} {data.token || 'ETH'}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: cfg.border, width: 8, height: 8 }} />
    </div>
  );
}

// ── Custom Transfer Edge with EdgeLabelRenderer (immune to line clipping) ────
function TransferEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [hovered, setHovered] = useState(false);
  const amountStr = data?.amount ? `${formatAmount(data.amount, 4)} ${data.token || 'ETH'}` : null;
  const isPending = data?.status === 'PENDING';

  // Stagger label position along the bezier path so parallel lines don't stack labels on top of each other!
  const offsetIndex = (data?.edgeIndex || 0) % 3;
  // 0 -> 50% (midpoint), 1 -> 36% (closer to source), 2 -> 64% (closer to target)
  const t = offsetIndex === 1 ? 0.36 : offsetIndex === 2 ? 0.64 : 0.50;
  const posX = sourceX + (targetX - sourceX) * t;
  const posY = sourceY + (targetY - sourceY) * t;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered || selected ? '#00f0ff' : isPending ? '#fbbf24' : '#334155',
          strokeWidth: hovered || selected ? 3 : isPending ? 2 : 1.5,
          strokeDasharray: isPending ? '5 5' : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      {/* Invisible wider stroke path for easy hovering on the line */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={18}
        className="cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {amountStr && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${posX}px,${posY}px)`,
              pointerEvents: 'all',
              zIndex: hovered || selected ? 1000 : 25,
            }}
            className="nodrag nopan cursor-pointer transition-transform hover:scale-110"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight shadow-md border backdrop-blur-md flex items-center gap-1 select-none ${
                hovered || selected
                  ? 'bg-cyan-950 text-cyan-200 border-cyan-400 ring-2 ring-cyan-400/50'
                  : isPending
                  ? 'bg-amber-950/95 text-amber-300 border-amber-500/70'
                  : 'bg-slate-950/95 text-slate-200 border-slate-700/90 hover:border-cyan-400 hover:text-cyan-300'
              }`}
              style={{
                boxShadow: hovered || selected ? '0 0 14px rgba(0, 240, 255, 0.5)' : '0 4px 10px rgba(0,0,0,0.7)',
              }}
            >
              <span>{amountStr}</span>
              {isPending && <span className="text-[8px] px-1 rounded bg-amber-500/30 text-amber-300">PENDING</span>}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { walletNode: WalletNode };
const edgeTypes = { transferEdge: TransferEdge };

// ── Hierarchical layout: BFS left→right ─────────────────────────────────────
function computeLayout(
  rawNodes: any[],
  rawEdges: any[],
  suspectAddress: string,
): { nodes: Node[]; edges: Edge[] } {
  const H_GAP = 340; // ample horizontal space to prevent line clustering
  const V_GAP = 120; // ample vertical space between wallets

  // Compute incoming and outgoing transfers per node for instant card display
  const nodeTransfers = new Map<string, { received: number; sent: number; token: string; primaryTxAmount: number; inCount: number; outCount: number }>();
  for (const e of rawEdges) {
    const amt = parseFloat(e.amount || '0') || 0;
    const token = e.token || e.asset || 'ETH';
    const src = (e.source || '').toLowerCase();
    const tgt = (e.target || '').toLowerCase();

    if (!nodeTransfers.has(src)) {
      nodeTransfers.set(src, { received: 0, sent: 0, token, primaryTxAmount: amt, inCount: 0, outCount: 0 });
    }
    const s = nodeTransfers.get(src)!;
    s.sent += amt;
    s.outCount += 1;
    if (!s.token) s.token = token;

    if (!nodeTransfers.has(tgt)) {
      nodeTransfers.set(tgt, { received: 0, sent: 0, token, primaryTxAmount: amt, inCount: 0, outCount: 0 });
    }
    const t = nodeTransfers.get(tgt)!;
    t.received += amt;
    t.inCount += 1;
    t.primaryTxAmount = amt;
    if (!t.token) t.token = token;
  }

  // BFS to assign columns (depths)
  const depthMap = new Map<string, number>();
  const queue: string[] = [suspectAddress.toLowerCase()];
  depthMap.set(suspectAddress.toLowerCase(), 0);

  const adjOut = new Map<string, Set<string>>();
  const adjIn  = new Map<string, Set<string>>();
  for (const e of rawEdges) {
    const src = (e.source || '').toLowerCase();
    const tgt = (e.target || '').toLowerCase();
    if (!adjOut.has(src)) adjOut.set(src, new Set());
    if (!adjIn.has(tgt))  adjIn.set(tgt, new Set());
    adjOut.get(src)!.add(tgt);
    adjIn.get(tgt)!.add(src);
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
    const id = (n.id || '').toLowerCase();
    const d = depthMap.get(id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n.id);
  }
  // Also add nodes not reachable from suspect (orphans → depth 999)
  for (const n of rawNodes) {
    const id = (n.id || '').toLowerCase();
    if (!depthMap.has(id)) {
      depthMap.set(id, 999);
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

  const nodes: Node[] = rawNodes.map((n: any) => {
    const id = (n.id || '').toLowerCase();
    const tr = nodeTransfers.get(id);
    const isSuspect = id === suspectAddress.toLowerCase();

    return {
      id: n.id,
      type: 'walletNode',
      position: posMap.get(n.id) ?? { x: 0, y: 0 },
      data: {
        label: n.label || `${n.id.slice(0, 6)}...${n.id.slice(-4)}`,
        address: n.address || n.id,
        nodeType: isSuspect ? 'suspect' : (n.type || 'wallet'),
        balance: n.balance,
        riskScore: n.riskScore,
        riskLevel: n.riskLevel,
        entityLabel: n.entityLabel,
        dataSource: n.dataSource,
        receivedAmount: tr?.received ?? 0,
        sentAmount: tr?.sent ?? 0,
        primaryTxAmount: tr?.primaryTxAmount ?? 0,
        token: tr?.token || 'ETH',
        inCount: tr?.inCount ?? 0,
        outCount: tr?.outCount ?? 0,
        isSuspect,
      },
    };
  });

  const edges: Edge[] = rawEdges.map((e: any, i: number) => {
    const token = e.token || e.asset || 'ETH';
    const amount = e.amount ? parseFloat(e.amount) : 0;
    const isPending = e.status === 'PENDING';

    return {
      id: `e-${i}-${e.txHash || i}`,
      source: e.source,
      target: e.target,
      type: 'transferEdge',
      animated: isPending, // ONLY animate pending transactions to prevent visual barcode noise
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isPending ? '#fbbf24' : '#475569',
      },
      data: {
        ...e,
        amount,
        token,
        status: e.status || 'CONFIRMED',
        edgeIndex: i,
      },
    };
  });

  return { nodes, edges };
}

// ── Graph View Inner Component ────────────────────────────────────────────────
function GraphViewContent() {
  const searchParams = useSearchParams();
  const initialAddress = searchParams.get('address') || '';

  const [address, setAddress] = useState(initialAddress);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ txCount: number; dataSource: string; provider: string } | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [copiedSelected, setCopiedSelected] = useState(false);

  const { addToast } = useUIStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [depth, setDepth] = useState<number>(2);

  // React Flow hooks for camera and preview radar movement
  const { setCenter, fitView } = useReactFlow();

  const buildGraph = useCallback(async (targetAddr?: string, targetDepth?: number) => {
    const addr = (targetAddr || address).trim();
    if (!addr) return;
    const currentDepth = targetDepth !== undefined ? targetDepth : depth;
    setLoading(true);
    setInfo(null);
    setSelectedNode(null);
    setSelectedEdge(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/graph/trace?address=${encodeURIComponent(addr)}&depth=${currentDepth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.nodes?.length) {
        addToast('No transactions found for this address. Run an investigation first or verify the address.', 'warning' as any);
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
        provider: data.providerName || 'Postgres Cache',
      });
      addToast(`Graph built: ${ln.length} wallets, ${le.length} transactions (${currentDepth} Hops)`, 'success' as any);
      setTimeout(() => {
        fitView({ padding: 0.25, duration: 600 });
      }, 100);
    } catch (err: any) {
      addToast(`Failed to build graph: ${err.message}`, 'error' as any);
    } finally {
      setLoading(false);
    }
  }, [address, depth, addToast, fitView]);

  // Automatically trace if an address was passed in URL query param
  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
      buildGraph(initialAddress, depth);
    }
  }, [initialAddress]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buildGraph();
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const copySelectedAddress = (addrToCopy?: string) => {
    const text = addrToCopy || selectedNode?.data?.address;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedSelected(true);
      addToast('Address copied to clipboard', 'success' as any);
      setTimeout(() => setCopiedSelected(false), 2000);
    }
  };

  // Quick navigation helpers
  const focusSuspect = useCallback(() => {
    const suspectNode = nodes.find(
      (n) => (n.data as any)?.isSuspect || n.id.toLowerCase() === address.trim().toLowerCase()
    );
    if (suspectNode && suspectNode.position) {
      setCenter(suspectNode.position.x + 80, suspectNode.position.y + 30, { duration: 500, zoom: 1.15 });
    } else if (nodes.length > 0) {
      setCenter(nodes[0].position.x + 80, nodes[0].position.y + 30, { duration: 500, zoom: 1.15 });
    }
  }, [nodes, address, setCenter]);

  const focusLatestHop = useCallback(() => {
    if (nodes.length === 0) return;
    let maxNode = nodes[0];
    for (const n of nodes) {
      if (n.position.x > maxNode.position.x) {
        maxNode = n;
      }
    }
    if (maxNode && maxNode.position) {
      setCenter(maxNode.position.x + 80, maxNode.position.y + 30, { duration: 500, zoom: 1.0 });
    }
  }, [nodes, setCenter]);

  // Compute node incoming / outgoing stats
  const selectedNodeStats = useMemo(() => {
    if (!selectedNode) return null;
    const nodeId = selectedNode.id.toLowerCase();
    const inEdges = edges.filter((e) => e.target.toLowerCase() === nodeId);
    const outEdges = edges.filter((e) => e.source.toLowerCase() === nodeId);

    let inTotal = 0;
    let outTotal = 0;
    let token = 'ETH';

    inEdges.forEach((e) => {
      const val = parseFloat(e.data?.amount || '0') || 0;
      inTotal += val;
      if (e.data?.token) token = e.data.token;
    });

    outEdges.forEach((e) => {
      const val = parseFloat(e.data?.amount || '0') || 0;
      outTotal += val;
      if (e.data?.token) token = e.data.token;
    });

    const outBranches = outEdges.map((e) => ({
      target: e.target,
      amount: e.data?.amount || '0',
      token: e.data?.token || 'ETH',
      txHash: e.data?.txHash,
      status: e.data?.status || 'CONFIRMED',
    }));

    return {
      inCount: inEdges.length,
      outCount: outEdges.length,
      inTotal: inTotal.toFixed(4),
      outTotal: outTotal.toFixed(4),
      token,
      outBranches,
    };
  }, [selectedNode, edges]);

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', gap: 16, padding: 24, position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#101318' }}>
            Transaction Graph
          </h1>
          <p className="text-sm font-mono mt-1" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            Fund flow visualization — BFS hierarchical layout with multi-hop tracing & interactive radar navigation
          </p>
        </div>
        {info && (
          <div
            className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border"
            style={{
              background: isDark ? '#1a1e2f' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#64748b',
              borderColor: isDark ? '#2a304a' : '#e2e8f0',
            }}
          >
            <Info className="w-3.5 h-3.5 text-neon-cyan" />
            <span>{info.txCount} txs</span>
            <span>•</span>
            <span>Source: {info.dataSource}</span>
            <span>•</span>
            <span>Provider: {info.provider}</span>
          </div>
        )}
      </div>

      {/* Search and Hop Depth Selector bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter wallet address to trace (e.g. 0x28C6c06... or TXcRND...)"
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'monospace',
            background: isDark ? '#1a1e2f' : '#f8fafc',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            color: isDark ? '#ffffff' : '#101318',
            outline: 'none',
          }}
        />

        {/* Multi-Hop Depth Selector */}
        <div
          className="flex items-center gap-1.5 p-1 rounded-lg border"
          style={{
            background: isDark ? '#1a1e2f' : '#f8fafc',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          }}
        >
          <span className="text-[11px] font-mono px-2 text-slate-400 font-semibold flex items-center gap-1">
            <Layers className="w-3 h-3 text-neon-cyan" />
            Hops:
          </span>
          {[1, 2, 3, 5, 10, 20].map((d) => (
            <button
              key={d}
              onClick={() => {
                setDepth(d);
                if (address.trim()) buildGraph(address, d);
              }}
              className="px-2 py-1 text-xs font-mono font-bold rounded transition-colors"
              style={{
                background: depth === d ? (isDark ? '#00f0ff' : '#0891b2') : 'transparent',
                color: depth === d ? '#000000' : (isDark ? '#94a3b8' : '#64748b'),
              }}
            >
              {d}
            </button>
          ))}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-700/60">
            <span className="text-[10px] text-slate-400 font-mono">Custom:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={depth}
              onChange={(e) => {
                const val = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                setDepth(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && address.trim()) buildGraph(address, depth);
              }}
              className="w-12 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-center outline-none"
              style={{
                background: isDark ? '#0b0f1a' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                color: isDark ? '#00f0ff' : '#0891b2',
              }}
              title="Custom depth hops (1-50)"
            />
          </div>
        </div>

        <button
          onClick={() => buildGraph()}
          disabled={loading || !address.trim()}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            background: loading ? '#334155' : '#00f0ff',
            color: '#000',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
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

      {/* Graph canvas container */}
      <div
        style={{
          flex: 1,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          background: isDark ? '#0b0f1a' : '#f8fafc',
          position: 'relative',
        }}
      >
        {nodes.length === 0 ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <AlertTriangle className="w-12 h-12" style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
            <p style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 14 }}>
              Enter a wallet address and click <strong>Trace</strong> to visualize the fund flow graph
            </p>
            <p style={{ color: isDark ? '#475569' : '#cbd5e1', fontSize: 12, fontFamily: 'monospace' }}>
              Tip: Click any node or transfer badge in the graph to view live balances, transfer volumes, and inspect on-chain details
            </p>
          </div>
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.1}
              maxZoom={2.5}
            >
              <Background color={isDark ? '#1e293b' : '#cbd5e1'} gap={24} />
              <Controls />

              {/* Interactive MiniMap with direct Drag & Click viewport navigation */}
              <MiniMap
                pannable={true}
                zoomable={true}
                nodeColor={(n) => NODE_CONFIG[n.data?.nodeType]?.bg || '#3b82f6'}
                nodeStrokeWidth={2}
                nodeBorderRadius={4}
                maskColor={isDark ? 'rgba(11, 15, 26, 0.75)' : 'rgba(241, 245, 249, 0.75)'}
                maskStrokeColor="#00f0ff"
                maskStrokeWidth={2}
                onNodeClick={(_e, node) => {
                  setSelectedNode(node);
                  setSelectedEdge(null);
                  if (node.position) {
                    setCenter(node.position.x + 80, node.position.y + 30, { duration: 400, zoom: 1.15 });
                  }
                }}
                style={{
                  background: isDark ? '#0b0f1a' : '#ffffff',
                  border: `2px solid ${isDark ? 'rgba(0, 240, 255, 0.4)' : '#cbd5e1'}`,
                  borderRadius: 12,
                  width: 240,
                  height: 160,
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.8)' : '0 8px 32px rgba(0,0,0,0.15)',
                }}
              />
            </ReactFlow>

            {/* Floating Navigation Radar Toolbar right above the preview window */}
            <div className="absolute bottom-[180px] right-4 z-10 flex flex-col gap-1.5 p-2 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-700/50">
                <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-neon-cyan">
                  <Compass className="w-3.5 h-3.5" />
                  Radar Navigator
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  Click/Drag Map
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => fitView({ padding: 0.25, duration: 500 })}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono font-bold transition-colors flex items-center gap-1 border border-slate-700/50"
                  title="Fit whole graph to screen"
                >
                  <Maximize2 className="w-3 h-3 text-neon-cyan" />
                  Fit All
                </button>
                <button
                  onClick={focusSuspect}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono font-bold transition-colors flex items-center gap-1 border border-slate-700/50"
                  title="Jump directly to Root Suspect (Hop 0)"
                >
                  <Crosshair className="w-3 h-3 text-red-400" />
                  Suspect
                </button>
                <button
                  onClick={focusLatestHop}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono font-bold transition-colors flex items-center gap-1 border border-slate-700/50"
                  title="Jump to Latest Hop Column"
                >
                  <Navigation className="w-3 h-3 text-emerald-400" />
                  Latest
                </button>
              </div>
            </div>
          </>
        )}

        {/* Selected Edge (Transaction) Inspector Card */}
        <AnimatePresence>
          {selectedEdge && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 z-20 rounded-xl border p-4 shadow-2xl backdrop-blur-md"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isDark ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 150, 180, 0.4)',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)',
                width: 340,
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-cyan animate-pulse" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    Transaction Transfer
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEdge(null)}
                  className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 space-y-3 font-mono">
                {/* Money Transferred Highlight */}
                <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Transferred Volume</span>
                  <div className="text-xl font-bold text-neon-cyan">
                    {formatAmount(selectedEdge.data?.amount || 0, 6)} {selectedEdge.data?.token || 'ETH'}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                      selectedEdge.data?.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {selectedEdge.data?.status || 'CONFIRMED'}
                    </span>
                  </div>
                </div>

                {/* From / To Addresses */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">FROM SENDER:</span>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-500/10 border border-slate-500/20">
                      <span className="truncate text-slate-200">{selectedEdge.source}</span>
                      <button
                        onClick={() => copySelectedAddress(selectedEdge.source)}
                        className="p-1 rounded hover:bg-slate-500/20 text-slate-300"
                        title="Copy sender address"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">TO RECIPIENT:</span>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-500/10 border border-slate-500/20">
                      <span className="truncate text-emerald-300 font-bold">{selectedEdge.target}</span>
                      <button
                        onClick={() => copySelectedAddress(selectedEdge.target)}
                        className="p-1 rounded hover:bg-slate-500/20 text-slate-300"
                        title="Copy recipient address"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {selectedEdge.data?.txHash && (
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">TRANSACTION HASH:</span>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-500/10 border border-slate-500/20">
                        <span className="truncate text-slate-300">{selectedEdge.data.txHash}</span>
                        <button
                          onClick={() => copySelectedAddress(selectedEdge.data.txHash)}
                          className="p-1 rounded hover:bg-slate-500/20 text-slate-300"
                          title="Copy transaction hash"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setAddress(selectedEdge.target);
                      buildGraph(selectedEdge.target);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/40"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Trace Recipient ({selectedEdge.target.slice(0, 6)}...{selectedEdge.target.slice(-4)})
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Node Inspector Drawer / Card */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 z-20 rounded-xl border p-4 shadow-2xl backdrop-blur-md"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isDark ? 'rgba(0, 240, 255, 0.3)' : 'rgba(0, 150, 180, 0.3)',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)',
                width: 320,
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: NODE_CONFIG[selectedNode.data.nodeType]?.bg || '#1e293b' }}
                  />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    {NODE_CONFIG[selectedNode.data.nodeType]?.label || 'WALLET'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {/* Node Label & Address */}
                <div>
                  <div className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    {selectedNode.data.label}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 p-2 rounded bg-slate-500/10 border border-slate-500/20 font-mono text-xs">
                    <span className="truncate" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                      {selectedNode.data.address}
                    </span>
                    <button
                      onClick={() => copySelectedAddress()}
                      className="p-1 rounded hover:bg-slate-500/20 text-slate-300"
                      title="Copy full address"
                    >
                      {copiedSelected ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Transfer Metrics in Graph */}
                {selectedNodeStats && (
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <ArrowDownLeft className="w-3 h-3 text-neon-green" /> INFLOW ({selectedNodeStats.inCount})
                      </div>
                      <div className="font-mono font-bold mt-0.5 text-xs truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                        {selectedNodeStats.inTotal} {selectedNodeStats.token}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <ArrowUpRight className="w-3 h-3 text-neon-red" /> OUTFLOW ({selectedNodeStats.outCount})
                      </div>
                      <div className="font-mono font-bold mt-0.5 text-xs truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                        {selectedNodeStats.outTotal} {selectedNodeStats.token}
                      </div>
                    </div>
                  </div>
                )}

                {/* Transferred Branches Outflow Section */}
                {selectedNodeStats && selectedNodeStats.outBranches?.length > 0 && (
                  <div className="p-2.5 rounded-lg border bg-slate-500/5" style={{ borderColor: isDark ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 150, 180, 0.2)' }}>
                    <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-700/50">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                        <GitBranch className="w-3 h-3" />
                        Transferred Branches ({selectedNodeStats.outBranches.length})
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Total {selectedNodeStats.outTotal} {selectedNodeStats.token}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedNodeStats.outBranches.map((branch: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-500/10 font-mono"
                        >
                          <div className="flex items-center gap-1 truncate mr-2">
                            <ArrowDownRight className="w-3 h-3 text-neon-cyan flex-shrink-0" />
                            <span className="truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                              {branch.target.slice(0, 6)}...{branch.target.slice(-4)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="font-bold text-neon-cyan">
                              {formatAmount(branch.amount, 6)} {branch.token}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddress(branch.target);
                                buildGraph(branch.target);
                              }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 hover:bg-neon-cyan/20 text-slate-300 hover:text-white transition-colors"
                              title="Trace this branch"
                            >
                              Trace
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={`/dashboard/wallets/${encodeURIComponent(selectedNode.data.address)}`}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: isDark ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 150, 180, 0.15)',
                      color: isDark ? '#00f0ff' : '#0891b2',
                      border: isDark ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(0, 150, 180, 0.4)',
                    }}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Open Live Wallet Intelligence
                  </Link>

                  <button
                    onClick={() => {
                      setAddress(selectedNode.data.address);
                      buildGraph(selectedNode.data.address);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isDark ? '#1e293b' : '#f1f5f9',
                      color: isDark ? '#cbd5e1' : '#475569',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Re-center Trace from this Wallet
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading Transaction Graph...</div>}>
      <ReactFlowProvider>
        <GraphViewContent />
      </ReactFlowProvider>
    </Suspense>
  );
}
