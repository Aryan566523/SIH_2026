'use client';

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
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

// ── Currency Conversion Rates & Formatting ────────────────────────────────────
const ETH_USD_RATE = 2500;
const BTC_USD_RATE = 64000;
const TRX_USD_RATE = 0.15;

function convertToUsd(amount: number, token?: string): number {
  const t = (token || 'ETH').toUpperCase();
  if (t.includes('USD')) return amount; // USDT, USDC, BUSD, DAI, etc.
  if (t === 'ETH' || t === 'WETH') return amount * ETH_USD_RATE;
  if (t === 'BTC' || t === 'WBTC') return amount * BTC_USD_RATE;
  if (t === 'TRX') return amount * TRX_USD_RATE;
  if (t === 'BNB') return amount * 580;
  if (t === 'SOL') return amount * 140;
  return amount * ETH_USD_RATE;
}

function formatNodeAmount(amount: number, token?: string, inDollars: boolean = false): string {
  if (inDollars) {
    const usdVal = convertToUsd(amount, token);
    return usdVal >= 1000000
      ? `$${(usdVal / 1000000).toFixed(2)}M`
      : usdVal >= 1000
      ? `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${usdVal.toFixed(2)}`;
  }
  return `${formatAmount(amount, amount < 1 ? 4 : 2)} ${token || 'ETH'}`;
}

// ── Layout constants ──────────────────────────────────────────────────────────

// ── Node type configuration ──────────────────────────────────────────────────
const NODE_CONFIG: Record<string, { bg: string; border: string; label: string }> = {
  victim:    { bg: '#eab308', border: '#a16207', label: 'VICTIM' },
  suspect:   { bg: '#ef4444', border: '#b91c1c', label: 'SUSPECT' },
  exchange:  { bg: '#8b5cf6', border: '#6d28d9', label: 'EXCHANGE' },
  vasp:      { bg: '#6366f1', border: '#4338ca', label: 'VASP' },
  mixer:     { bg: '#f97316', border: '#c2410c', label: 'MIXER' },
  bridge:    { bg: '#0284c7', border: '#0369a1', label: 'BRIDGE' },
  dex:       { bg: '#10b981', border: '#047857', label: 'DEX' },
  miner:     { bg: '#3b82f6', border: '#1d4ed8', label: 'MINER / VALIDATOR' },
  infra:     { bg: '#3b82f6', border: '#1d4ed8', label: 'MINER / VALIDATOR' },
  high_risk: { bg: '#be123c', border: '#881337', label: 'HIGH RISK' },
  contract:  { bg: '#14b8a6', border: '#0f766e', label: 'CONTRACT' },
  wallet:    { bg: '#334155', border: '#475569', label: 'WALLET' },
  default:   { bg: '#334155', border: '#475569', label: 'WALLET' },
};

// ── Custom Node Component with Direct Money Transferred Badge ────────────────
function WalletNode({ data }: NodeProps) {
  const cfg = NODE_CONFIG[data.nodeType] || NODE_CONFIG.default;
  const isSuspect = data.nodeType === 'suspect' || data.isSuspect;
  const isVictim = data.nodeType === 'victim';
  const isDollarMode = Boolean(data.isDollarMode);
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
        boxShadow: isSuspect ? `0 0 20px ${cfg.bg}aa` : isVictim ? `0 0 20px ${cfg.bg}88` : '0 4px 14px rgba(0,0,0,0.5)',
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

      {/* Prominently visible transferred money inside node card */}
      {isSuspect && hasSent && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-black/45 border border-white/20 text-[10px] font-mono font-bold text-white flex items-center justify-center gap-1 shadow-sm"
          title={`Total Outflow: ${formatNodeAmount(data.sentAmount, data.token, isDollarMode)} (${formatAmount(data.sentAmount, 4)} ${data.token || 'ETH'})`}
        >
          <ArrowUpRight className="w-3 h-3 text-red-300 flex-shrink-0" />
          <span className="truncate">Out: {formatNodeAmount(data.sentAmount, data.token, isDollarMode)}</span>
        </div>
      )}

      {isVictim && hasSent && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400/60 text-[10px] font-mono font-bold text-amber-300 flex items-center justify-center gap-1 shadow-sm"
          title={`Loss Transferred: ${formatNodeAmount(data.sentAmount, data.token, isDollarMode)} (${formatAmount(data.sentAmount, 4)} ${data.token || 'ETH'})`}
        >
          <ArrowUpRight className="w-3 h-3 text-amber-300 flex-shrink-0" />
          <span className="truncate">Out: {formatNodeAmount(data.sentAmount, data.token, isDollarMode)}</span>
        </div>
      )}

      {!isSuspect && !isVictim && hasReceived && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/60 text-[10px] font-mono font-bold text-emerald-300 flex items-center justify-center gap-1 shadow-sm"
          title={`Received: ${formatNodeAmount(data.receivedAmount, data.token, isDollarMode)} (${formatAmount(data.receivedAmount, 4)} ${data.token || 'USDT'})`}
        >
          <ArrowDownLeft className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <span className="truncate">+{formatNodeAmount(data.receivedAmount, data.token, isDollarMode)}</span>
        </div>
      )}

      {!isSuspect && !isVictim && !hasReceived && hasSent && (
        <div
          className="mt-2 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/60 text-[10px] font-mono font-bold text-cyan-300 flex items-center justify-center gap-1 shadow-sm"
          title={`Sent: ${formatNodeAmount(data.sentAmount, data.token, isDollarMode)} (${formatAmount(data.sentAmount, 4)} ${data.token || 'ETH'})`}
        >
          <ArrowUpRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span className="truncate">-{formatNodeAmount(data.sentAmount, data.token, isDollarMode)}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: cfg.border, width: 8, height: 8 }} />
    </div>
  );
}

// ── Custom Transfer Edge with EdgeLabelRenderer (immune to line clipping) ────
function TransferEdge({
  id,
  source,
  target,
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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [hovered, setHovered] = useState(false);
  const isPending = data?.status === 'PENDING';

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
    </>
  );
}

const nodeTypes = { walletNode: WalletNode };
const edgeTypes = { transferEdge: TransferEdge };

// ── 2D-aware hierarchical layout ─────────────────────────────────────────────
// Each depth "rank" is a column on the X axis.
// Within a rank, nodes are arranged in a grid pattern so large graphs
// spread in 2D instead of becoming a thin vertical strip.
function computeLayout(
  rawNodes: any[],
  rawEdges: any[],
  suspectAddress: string,
  victimAddress?: string,
  isDollarMode: boolean = false,
): { nodes: Node[]; edges: Edge[] } {
  // Node card dimensions + gaps
  const NODE_W = 220;  // approximate rendered card width
  const NODE_H = 90;   // approximate rendered card height
  const COL_GAP = 280; // horizontal gap between depth columns
  const ROW_GAP = 70;  // vertical gap between rows within a column
  // Max nodes stacked vertically in one depth column before wrapping to sub-columns
  const MAX_ROWS_PER_COL = 6;
  // Horizontal spacing between sub-columns within the same depth
  const SUBCOL_GAP = 100;

  // Compute incoming and outgoing transfers per node for card display
  const nodeTransfers = new Map<string, { received: number; sent: number; token: string; primaryTxAmount: number; inCount: number; outCount: number }>();
  for (const e of rawEdges) {
    const amt = parseFloat(e.amount || '0') || 0;
    const token = e.token || e.asset || 'ETH';
    const src = (e.source || '').toLowerCase();
    const tgt = (e.target || '').toLowerCase();

    if (!nodeTransfers.has(src)) nodeTransfers.set(src, { received: 0, sent: 0, token, primaryTxAmount: amt, inCount: 0, outCount: 0 });
    const s = nodeTransfers.get(src)!;
    s.sent += amt; s.outCount += 1;
    if (!s.token) s.token = token;

    if (!nodeTransfers.has(tgt)) nodeTransfers.set(tgt, { received: 0, sent: 0, token, primaryTxAmount: amt, inCount: 0, outCount: 0 });
    const t = nodeTransfers.get(tgt)!;
    t.received += amt; t.inCount += 1; t.primaryTxAmount = amt;
    if (!t.token) t.token = token;
  }

  // Build adjacency maps
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

  // Forward BFS to assign depth (X rank)
  const depthMap = new Map<string, number>();
  const queue: string[] = [suspectAddress.toLowerCase()];
  depthMap.set(suspectAddress.toLowerCase(), 0);
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
  // Assign orphan nodes to depth 999
  for (const n of rawNodes) {
    const id = (n.id || '').toLowerCase();
    if (!depthMap.has(id)) depthMap.set(id, 999);
  }

  // Group nodes by depth
  const columns = new Map<number, string[]>();
  for (const n of rawNodes) {
    const id = (n.id || '').toLowerCase();
    const d = depthMap.get(id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n.id);
  }

  // Sort suspect to top within its column, sort others by transfer amount (desc)
  for (const [, col] of columns) {
    col.sort((a, b) => {
      const aId = a.toLowerCase();
      const bId = b.toLowerCase();
      if (aId === suspectAddress.toLowerCase()) return -1;
      if (bId === suspectAddress.toLowerCase()) return 1;
      const aRec = nodeTransfers.get(aId)?.received ?? 0;
      const bRec = nodeTransfers.get(bId)?.received ?? 0;
      return bRec - aRec;
    });
  }

  const sortedDepths = Array.from(columns.keys()).sort((a, b) => a - b);

  // Calculate cumulative X position for each depth rank (accounting for sub-column wrapping)
  // Each rank may have multiple sub-columns if it contains more than MAX_ROWS_PER_COL nodes
  const rankXStart = new Map<number, number>();
  const rankWidth  = new Map<number, number>();
  let curX = 0;

  for (const depth of sortedDepths) {
    const col = columns.get(depth)!;
    const numSubCols = Math.ceil(col.length / MAX_ROWS_PER_COL);
    rankXStart.set(depth, curX);
    const totalRankWidth = numSubCols * NODE_W + (numSubCols - 1) * SUBCOL_GAP;
    rankWidth.set(depth, totalRankWidth);
    curX += totalRankWidth + COL_GAP;
  }

  const posMap = new Map<string, { x: number; y: number }>();
  for (const depth of sortedDepths) {
    const col = columns.get(depth)!;
    const xStart = rankXStart.get(depth)!;

    col.forEach((id, idx) => {
      const subColIdx = Math.floor(idx / MAX_ROWS_PER_COL);
      const rowIdx    = idx % MAX_ROWS_PER_COL;
      const rowsInSubCol = Math.min(MAX_ROWS_PER_COL, col.length - subColIdx * MAX_ROWS_PER_COL);
      const subColHeight = rowsInSubCol * NODE_H + (rowsInSubCol - 1) * ROW_GAP;

      const x = xStart + subColIdx * (NODE_W + SUBCOL_GAP);
      // Center each sub-column vertically around y=0
      const y = rowIdx * (NODE_H + ROW_GAP) - subColHeight / 2;
      posMap.set(id, { x, y });
    });
  }

  const nodes: Node[] = rawNodes.map((n: any) => {
    const id = (n.id || '').toLowerCase();
    const tr = nodeTransfers.get(id);
    const isSuspect = id === suspectAddress.toLowerCase();
    const isVictim = !!victimAddress && id === victimAddress.trim().toLowerCase();

    const isHighRisk = n.type === 'high_risk' || (n.riskScore && n.riskScore > 75) || n.riskLevel === 'HIGH' || n.riskLevel === 'CRITICAL';
    const resolvedNodeType = isSuspect ? 'suspect' : isVictim ? 'victim' : (isHighRisk ? 'high_risk' : (n.type || 'wallet'));

    return {
      id: n.id,
      type: 'walletNode',
      position: posMap.get(n.id) ?? { x: 0, y: 0 },
      data: {
        label: n.label || `${n.id.slice(0, 6)}...${n.id.slice(-4)}`,
        address: n.address || n.id,
        nodeType: resolvedNodeType,
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
        isDollarMode,
      },
    };
  });

  // Track parallel edges between same source-target pairs
  const pairCountMap = new Map<string, number>();
  
  const edges: Edge[] = rawEdges.map((e: any, i: number) => {
    const token = e.token || e.asset || 'ETH';
    const amount = e.amount ? parseFloat(e.amount) : 0;
    const isPending = e.status === 'PENDING';
    
    const pairKey = `${e.source}->${e.target}`;
    const pairIndex = pairCountMap.get(pairKey) || 0;
    pairCountMap.set(pairKey, pairIndex + 1);

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
        pairIndex,
        pairKey,
      },
    };
  });
  
  // Now patch totalPairs into the edges
  edges.forEach((edge) => {
    edge.data.totalPairs = pairCountMap.get(edge.data.pairKey) || 1;
  });

  return { nodes, edges };
}

// ── Graph View Inner Component ────────────────────────────────────────────────
function GraphViewContent() {
  const searchParams = useSearchParams();
  const initialAddress = searchParams.get('address') || '';
  const initialVictim = searchParams.get('victim') || searchParams.get('victimAddress') || '';
  const initialMinAmount = searchParams.get('minAmount') || searchParams.get('amount') || '';

  const [address, setAddress] = useState(initialAddress);
  const [traceVictim, setTraceVictim] = useState(Boolean(initialVictim || initialMinAmount));
  const [victimAddress, setVictimAddress] = useState(initialVictim);
  const [minAmount, setMinAmount] = useState(initialMinAmount);
  const isDollarMode = Boolean(minAmount.trim());

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
  const { setCenter, fitView, getViewport, setViewport } = useReactFlow();

  // Instant update to rendered node cards when isDollarMode toggles
  useEffect(() => {
    if (nodes.length > 0) {
      setNodes((prevNodes) =>
        prevNodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isDollarMode,
          },
        }))
      );
    }
  }, [isDollarMode]);

  // ── Custom MiniMap drag with user-defined sensitivity formula ─────────────
  // Formula: speed = graphDelta / (2 + zoom * 1.5)
  // Higher zoom → slower minimap drag so it never feels too jumpy.
  const MMAP_W = 240;
  const MMAP_H = 160;

  const mmDragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false, lastX: 0, lastY: 0,
  });
  const [mmDragging, setMmDragging] = useState(false);

  // Bounding box of current graph nodes (used to derive minimap→graph scale)
  const graphBounds = useMemo(() => {
    if (nodes.length === 0) return { w: 1600, h: 900 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + 220); // node card width
      minY = Math.min(minY, n.position.y);
      maxY = Math.max(maxY, n.position.y + 90);  // node card height
    }
    return { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }, [nodes]);

  const onMmPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    mmDragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
    setMmDragging(true);
  }, []);

  const onMmPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!mmDragRef.current.dragging) return;
    const dx = e.clientX - mmDragRef.current.lastX;
    const dy = e.clientY - mmDragRef.current.lastY;
    mmDragRef.current.lastX = e.clientX;
    mmDragRef.current.lastY = e.clientY;

    const vp = getViewport();
    // Convert minimap pixel delta → graph coordinate delta
    const scaleX = graphBounds.w / MMAP_W;
    const scaleY = graphBounds.h / MMAP_H;
    // Sensitivity formula: current / (2 + zoom * 1.5)
    // At zoom=1 → factor ≈ 0.29 (less than 1/3 speed)
    // At zoom=2 → factor ≈ 0.20 (even slower at high zoom)
    const sens = 1 / (2 + vp.zoom * 1.5);
    // Dragging right in minimap = panning graph right = viewport.x decreases
    setViewport(
      { x: vp.x - dx * scaleX * vp.zoom * sens, y: vp.y - dy * scaleY * vp.zoom * sens, zoom: vp.zoom },
      { duration: 0 },
    );
  }, [getViewport, setViewport, graphBounds]);

  const onMmPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    mmDragRef.current.dragging = false;
    setMmDragging(false);
  }, []);


  const buildGraph = useCallback(async (
    targetAddr?: string,
    targetDepth?: number,
    overrideTraceVictim?: boolean,
    overrideVictim?: string,
    overrideMinAmount?: string,
  ) => {
    const addr = (targetAddr || address).trim();
    if (!addr) return;
    const currentDepth = targetDepth !== undefined ? targetDepth : depth;
    const curTraceVictim = overrideTraceVictim !== undefined ? overrideTraceVictim : traceVictim;
    const curVictim = (overrideVictim !== undefined ? overrideVictim : victimAddress).trim();
    const curMinAmount = (overrideMinAmount !== undefined ? overrideMinAmount : minAmount).trim();

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

      let filteredNodes = data.nodes;
      let filteredEdges = data.edges;

      if (curTraceVictim) {
        if (curMinAmount) {
          const minAmtNum = parseFloat(curMinAmount) || 0;
          filteredEdges = filteredEdges.filter((e: any) => {
            const rawAmt = parseFloat(e.amount || '0') || 0;
            const token = (e.token || e.asset || 'ETH').toUpperCase();
            // Convert to USD: stablecoins = 1:1, ETH = ~$2500 USD
            const fiatVal = e.fiatEquivalent != null ? e.fiatEquivalent : convertToUsd(rawAmt, token);
            return fiatVal >= minAmtNum || rawAmt >= minAmtNum;
          });
        }

        if (curVictim) {
          const victim = curVictim.toLowerCase();
          const reachable = new Set<string>([victim]);
          let changed = true;
          // Forward BFS from Victim
          while (changed) {
            changed = false;
            for (const e of filteredEdges) {
              const src = (e.source || '').toLowerCase();
              const tgt = (e.target || '').toLowerCase();
              if (reachable.has(src) && !reachable.has(tgt)) {
                reachable.add(tgt);
                changed = true;
              }
            }
          }
          
          filteredEdges = filteredEdges.filter((e: any) => reachable.has((e.source || '').toLowerCase()) && reachable.has((e.target || '').toLowerCase()));
          filteredNodes = filteredNodes.filter((n: any) => reachable.has((n.id || '').toLowerCase()));

          // If victim isn't in graph, or suspect isn't reachable, warn user
          if (!reachable.has(addr.toLowerCase())) {
            addToast('Victim address is not connected to the suspect in this trace depth!', 'warning' as any);
          }
        }
      }

      const activeDollarMode = Boolean(curMinAmount);
      const { nodes: ln, edges: le } = computeLayout(
        filteredNodes,
        filteredEdges,
        addr,
        curTraceVictim && curVictim ? curVictim : undefined,
        activeDollarMode,
      );
      setNodes(ln);
      setEdges(le);
      setInfo({
        txCount: data.edges?.length ?? 0,
        dataSource: data.dataSource || 'DATABASE',
        provider: data.providerName || 'Postgres Cache',
      });
      addToast(`Graph built: ${ln.length} wallets, ${le.length} transactions (${currentDepth} Hops)`, 'success' as any);
      setTimeout(() => {
        fitView({ padding: 0.4, duration: 700, includeHiddenNodes: false });
      }, 150);
    } catch (err: any) {
      addToast(`Failed to build graph: ${err.message}`, 'error' as any);
    } finally {
      setLoading(false);
    }
  }, [address, depth, traceVictim, victimAddress, minAmount, addToast, fitView]);

  // Automatically trace if an address was passed in URL query param
  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
      if (initialVictim) setVictimAddress(initialVictim);
      if (initialMinAmount) setMinAmount(initialMinAmount);
      const shouldTraceVictim = Boolean(initialVictim || initialMinAmount);
      if (shouldTraceVictim) setTraceVictim(true);
      buildGraph(
        initialAddress,
        depth,
        shouldTraceVictim,
        initialVictim,
        initialMinAmount,
      );
    }
  }, [initialAddress, initialVictim, initialMinAmount]);

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
      amountDisplay: formatNodeAmount(parseFloat(e.data?.amount || '0') || 0, e.data?.token || 'ETH', isDollarMode),
    }));

    return {
      inCount: inEdges.length,
      outCount: outEdges.length,
      inTotal: formatNodeAmount(inTotal, token, isDollarMode),
      outTotal: formatNodeAmount(outTotal, token, isDollarMode),
      rawInTotal: inTotal.toFixed(4),
      rawOutTotal: outTotal.toFixed(4),
      token,
      outBranches,
    };
  }, [selectedNode, edges, isDollarMode]);

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

      {/* Search and Advanced Filters */}
      <div className="flex flex-col gap-3">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter Suspect Wallet Address (e.g. 0x28C6c06... or TXcRND...)"
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
          <button
            onClick={() => setTraceVictim(!traceVictim)}
            className="px-3 py-2 text-xs font-semibold rounded border transition-colors flex items-center gap-1.5"
            style={{
              background: traceVictim ? (isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(8, 145, 178, 0.1)') : (isDark ? '#1a1e2f' : '#f8fafc'),
              borderColor: traceVictim ? (isDark ? '#00f0ff' : '#0891b2') : (isDark ? '#334155' : '#e2e8f0'),
              color: traceVictim ? (isDark ? '#00f0ff' : '#0891b2') : (isDark ? '#94a3b8' : '#64748b'),
            }}
            title="Enable advanced filtering between a victim and suspect"
          >
            <GitBranch className="w-3.5 h-3.5" />
            Victim Path
          </button>
        </div>

        {traceVictim && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-4 items-center">
            <input
              value={victimAddress}
              onChange={(e) => setVictimAddress(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter Victim Address (Start of Flow)"
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'monospace',
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px dashed ${isDark ? '#475569' : '#cbd5e1'}`,
                color: isDark ? '#ffffff' : '#101318',
                outline: 'none',
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Min Amount ($):</span>
              <input
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 200"
                style={{
                  width: 120,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  background: isDark ? '#0f172a' : '#ffffff',
                  border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                  color: isDark ? '#00f0ff' : '#0891b2',
                  outline: 'none',
                }}
              />
            </div>
          </motion.div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>


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
                color: depth === d ? (isDark ? '#000000' : '#ffffff') : (isDark ? '#94a3b8' : '#64748b'),
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
            background: loading ? (isDark ? '#334155' : '#cbd5e1') : (isDark ? '#00f0ff' : '#0891b2'),
            color: loading ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#000000' : '#ffffff'),
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
        {Object.entries(NODE_CONFIG).filter(([k]) => k !== 'default' && k !== 'infra').map(([type, cfg]) => (
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
              fitViewOptions={{ padding: 0.35, includeHiddenNodes: false }}
              minZoom={0.03}
              maxZoom={2.0}
              zoomOnScroll={true}
              panOnDrag={true}
              panOnScroll={false}
              preventScrolling={true}
              translateExtent={[[-50000, -50000], [50000, 50000]]}
            >
              <Background color={isDark ? '#1e293b' : '#cbd5e1'} gap={24} />
              <Controls />

              {/* MiniMap — pannable disabled; custom overlay below handles drag with tuned sensitivity */}
              <MiniMap
                pannable={false}
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
                  width: MMAP_W,
                  height: MMAP_H,
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.8)' : '0 8px 32px rgba(0,0,0,0.15)',
                }}
              />
            </ReactFlow>

            {/* ── Sensitivity-controlled MiniMap drag overlay ──────────────────────
                Sits exactly on top of the MiniMap (same position/size, higher z-index).
                Intercepts pointer events so we can apply:  speed = Δ / (2 + zoom×1.5)  */}
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                width: MMAP_W,
                height: MMAP_H,
                zIndex: 20,
                borderRadius: 12,
                cursor: mmDragging ? 'grabbing' : 'grab',
              }}
              onPointerDown={onMmPointerDown}
              onPointerMove={onMmPointerMove}
              onPointerUp={onMmPointerUp}
              onPointerLeave={onMmPointerUp}
              title="Drag to pan graph (sensitivity: speed ÷ (2 + zoom × 1.5))"
            />


            {/* Floating Navigation Radar Toolbar right above the preview window */}
            <div 
              className="absolute bottom-[180px] right-4 z-10 flex flex-col gap-1.5 p-2 rounded-xl shadow-2xl backdrop-blur-md"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(203, 213, 225, 0.8)',
                borderWidth: 1,
              }}
            >
              <div className="flex items-center justify-between gap-2 pb-1 border-b" style={{ borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 1)' }}>
                <span className="flex items-center gap-1 text-[11px] font-mono font-bold" style={{ color: isDark ? '#00f0ff' : '#0891b2' }}>
                  <Compass className="w-3.5 h-3.5" />
                  Radar Navigator
                </span>
                <span className="text-[9px] font-mono" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  Click/Drag Map
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => fitView({ padding: 0.4, duration: 600, includeHiddenNodes: false })}
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors flex items-center gap-1 border"
                  style={{
                    background: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#cbd5e1',
                    color: isDark ? '#cbd5e1' : '#475569',
                  }}
                  title="Fit whole graph to screen"
                >
                  <Maximize2 className="w-3 h-3" style={{ color: isDark ? '#00f0ff' : '#0891b2' }} />
                  Fit All
                </button>
                <button
                  onClick={focusSuspect}
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors flex items-center gap-1 border"
                  style={{
                    background: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#cbd5e1',
                    color: isDark ? '#cbd5e1' : '#475569',
                  }}
                  title="Jump directly to Root Suspect (Hop 0)"
                >
                  <Crosshair className="w-3 h-3 text-red-400" />
                  Suspect
                </button>
                <button
                  onClick={focusLatestHop}
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors flex items-center gap-1 border"
                  style={{
                    background: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#cbd5e1',
                    color: isDark ? '#cbd5e1' : '#475569',
                  }}
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
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-xl border shadow-2xl backdrop-blur-md flex flex-col"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isDark ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 150, 180, 0.4)',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)',
                width: 'min(340px, calc(100% - 1.5rem))',
                maxHeight: 'calc(100% - 1.5rem)',
              }}
            >
              <div className="p-3.5 pb-2.5 border-b shrink-0 flex items-center justify-between" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neon-cyan animate-pulse shrink-0" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    Transaction Transfer
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEdge(null)}
                  className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 pt-2.5 overflow-y-auto space-y-3 font-mono flex-1 min-h-0 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/30">
                {/* Money Transferred Highlight */}
                <div className="p-3 rounded-lg border text-center" style={{ background: isDark ? 'rgba(8, 51, 68, 0.4)' : 'rgba(224, 242, 254, 0.5)', borderColor: isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(14, 165, 233, 0.3)' }}>
                  <span className="text-[10px] uppercase tracking-wider block mb-0.5" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Transferred Volume</span>
                  <div className="text-xl font-bold" style={{ color: isDark ? '#00f0ff' : '#0284c7' }}>
                    {formatNodeAmount(selectedEdge.data?.amount || 0, selectedEdge.data?.token, isDollarMode)}
                  </div>
                  {isDollarMode && (
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {formatAmount(selectedEdge.data?.amount || 0, 6)} {selectedEdge.data?.token || 'ETH'}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                      selectedEdge.data?.status === 'PENDING' 
                        ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700') 
                        : (isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                    }`}>
                      {selectedEdge.data?.status || 'CONFIRMED'}
                    </span>
                  </div>
                </div>

                {/* From / To Addresses */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] block mb-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>FROM SENDER:</span>
                    <div className="flex items-center justify-between p-2 rounded border" style={{ background: isDark ? 'rgba(100,116,139,0.1)' : 'rgba(241,245,249,0.8)', borderColor: isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0' }}>
                      <span className="truncate" style={{ color: isDark ? '#e2e8f0' : '#334155' }}>{selectedEdge.source}</span>
                      <button
                        onClick={() => copySelectedAddress(selectedEdge.source)}
                        className="p-1 rounded transition-colors"
                        style={{ color: isDark ? '#cbd5e1' : '#64748b' }}
                        title="Copy sender address"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] block mb-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>TO RECIPIENT:</span>
                    <div className="flex items-center justify-between p-2 rounded border" style={{ background: isDark ? 'rgba(100,116,139,0.1)' : 'rgba(241,245,249,0.8)', borderColor: isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0' }}>
                      <span className="truncate font-bold" style={{ color: isDark ? '#6ee7b7' : '#059669' }}>{selectedEdge.target}</span>
                      <button
                        onClick={() => copySelectedAddress(selectedEdge.target)}
                        className="p-1 rounded transition-colors"
                        style={{ color: isDark ? '#cbd5e1' : '#64748b' }}
                        title="Copy recipient address"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {selectedEdge.data?.txHash && (
                    <div>
                      <span className="text-[10px] block mb-1" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>TRANSACTION HASH:</span>
                      <div className="flex items-center justify-between p-2 rounded border" style={{ background: isDark ? 'rgba(100,116,139,0.1)' : 'rgba(241,245,249,0.8)', borderColor: isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0' }}>
                        <span className="truncate" style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{selectedEdge.data.txHash}</span>
                        <button
                          onClick={() => copySelectedAddress(selectedEdge.data.txHash)}
                          className="p-1 rounded transition-colors"
                          style={{ color: isDark ? '#cbd5e1' : '#64748b' }}
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
                      buildGraph(selectedEdge.target, depth);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all border"
                    style={{
                      background: isDark ? 'rgba(0,240,255,0.2)' : 'rgba(8,145,178,0.1)',
                      color: isDark ? '#00f0ff' : '#0891b2',
                      borderColor: isDark ? 'rgba(0,240,255,0.4)' : 'rgba(8,145,178,0.3)',
                    }}
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
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-xl border shadow-2xl backdrop-blur-md flex flex-col"
              style={{
                background: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isDark ? 'rgba(0, 240, 255, 0.35)' : 'rgba(0, 150, 180, 0.35)',
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.1)',
                width: 'min(340px, calc(100% - 1.5rem))',
                maxHeight: 'calc(100% - 1.5rem)',
              }}
            >
              <div className="p-3.5 pb-2.5 border-b shrink-0 flex items-center justify-between" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: NODE_CONFIG[selectedNode.data.nodeType]?.bg || '#1e293b' }}
                  />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                    {NODE_CONFIG[selectedNode.data.nodeType]?.label || 'WALLET'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 pt-2.5 overflow-y-auto space-y-3 flex-1 min-h-0 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/30">
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
                        {selectedNodeStats.inTotal}
                      </div>
                      {isDollarMode && (
                        <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                          {selectedNodeStats.rawInTotal} {selectedNodeStats.token}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <ArrowUpRight className="w-3 h-3 text-neon-red" /> OUTFLOW ({selectedNodeStats.outCount})
                      </div>
                      <div className="font-mono font-bold mt-0.5 text-xs truncate" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                        {selectedNodeStats.outTotal}
                      </div>
                      {isDollarMode && (
                        <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                          {selectedNodeStats.rawOutTotal} {selectedNodeStats.token}
                        </div>
                      )}
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
                        Total {selectedNodeStats.outTotal}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/30">
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
                              {branch.amountDisplay || `${formatAmount(branch.amount, 4)} ${branch.token}`}
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
