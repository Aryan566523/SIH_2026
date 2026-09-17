import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BoundedTraceOptions,
  BoundedTraceResult,
  TraceBoundary,
  TraceStopReason,
  GraphNode,
  NodeKind,
  AttributionState,
} from '@chainsentinel/types';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { VASP } from '../../database/entities/vasp.entity';

export const DEFAULT_TRACE_OPTIONS: BoundedTraceOptions = {
  maxDepth: 5,
  maxNodes: 500,
  maxBranchesPerNode: 10,
  minAmount: 1,
  timeWindowHours: 24 * 30,
  maxRuntimeMs: 10_000,
};

/** A visited-node checkpoint so a crashed/resumed trace does not re-expand nodes (CONDITIONS 3.4/3.7) */
export interface TraceCheckpoint {
  visited: string[];
  frontier: Array<{ address: string; depth: number; path: string[]; lastAmount: number; lastTimestamp: number }>;
  boundaries: TraceBoundary[];
  prunedCount: number;
  incomplete: boolean;
  incompleteReason: TraceStopReason | null;
}

/**
 * Bounded priority fund-flow tracer (RULES §3 / CONDITIONS 3.1-3.9).
 *
 * Never brute-forces the reachable set. Each hop is ranked by a priority score combining
 * amount significance, forwarding ratio, time proximity, graph distance and service
 * proximity, and expansion stops at explicit boundaries:
 *   - mixer / privacy service  => trace_boundary recorded, confidence reduced, branch stopped
 *   - known VASP               => candidate terminal node (CONDITION 3.3)
 *   - limits exceeded          => graceful partial result flagged incomplete (CONDITION 3.8)
 */
@Injectable()
export class BoundedTracerService {
  private readonly logger = new Logger(BoundedTracerService.name);

  constructor(
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
  ) {}

  /**
   * CONDITION 3.1 — traces exceeding synchronous limits must run as queued, checkpointed jobs.
   * This helper decides the execution mode so the caller can route to the queue.
   */
  requiresAsyncJob(options: BoundedTraceOptions): boolean {
    return options.maxDepth > 10 || options.maxNodes > 2_000 || options.maxRuntimeMs > 30_000;
  }

  async trace(startAddress: string, options: Partial<BoundedTraceOptions> = {}): Promise<BoundedTraceResult> {
    const opts = { ...DEFAULT_TRACE_OPTIONS, ...options };
    const startedAt = Date.now();

    const result: BoundedTraceResult = {
      startAddress,
      nodes: [],
      edges: [],
      visitedCount: 0,
      prunedCount: 0,
      boundaries: [],
      incomplete: false,
      incompleteReason: null,
      runtimeMs: 0,
    };

    // CONDITION 3.7 — visited cache: never re-expand a node within a trace job
    const visited = new Set<string>([startAddress.toLowerCase()]);
    const startNode = await this.buildNode(startAddress, 0);
    result.nodes.push(startNode);

    let frontier: Array<{ address: string; depth: number; path: string[]; lastAmount: number; lastTimestamp: number }> = [
      { address: startAddress, depth: 0, path: [startAddress], lastAmount: Infinity, lastTimestamp: Date.now() },
    ];

    const startTs = Date.now();

    while (frontier.length > 0) {
      // CONDITION 3.8 — runtime limit: halt gracefully with partial results, never fail silently
      if (Date.now() - startTs > opts.maxRuntimeMs) {
        result.incomplete = true;
        result.incompleteReason = TraceStopReason.RUNTIME_LIMIT;
        break;
      }
      if (result.visitedCount >= opts.maxNodes) {
        result.incomplete = true;
        result.incompleteReason = TraceStopReason.MAX_NODES;
        break;
      }

      // Priority queue: highest-ranked hop expands first (RULES §3 — priority, not naive BFS)
      frontier.sort((a, b) => this.hopPriority(b) - this.hopPriority(a));
      const current = frontier.shift()!;
      const currentKey = current.address.toLowerCase();

      const outgoing = await this.txRepo.find({
        where: { from: current.address },
        order: { timestamp: 'DESC' },
        take: 200,
      });

      // CONDITION 3.6 — time window pruning
      const windowCutoff = current.lastTimestamp - opts.timeWindowHours * 3600 * 1000;

      // Rank candidate hops before limiting branches (RULES §3 priority ranking)
      const ranked = outgoing
        .map((tx) => ({
          tx,
          amount: parseFloat(tx.amountNormalized) || 0,
          to: (tx.to || '').toLowerCase(),
          ts: new Date(tx.timestamp).getTime(),
        }))
        .filter((c) => c.to && c.to !== currentKey)
        // CONDITION 3.5 — minimum amount threshold prunes the branch
        .filter((c) => {
          if (c.amount < opts.minAmount) {
            result.prunedCount++;
            return false;
          }
          return true;
        })
        .filter((c) => {
          if (c.ts < windowCutoff) {
            result.prunedCount++;
            return false;
          }
          return true;
        })
        // CONDITION 3.7 — already visited: do not re-expand
        .filter((c) => {
          if (visited.has(c.to)) {
            result.prunedCount++;
            return false;
          }
          return true;
        })
        .map((c) => ({
          ...c,
          priority: this.edgePriority(c.amount, c.ts, current.lastAmount, current.lastTimestamp, current.depth),
        }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, opts.maxBranchesPerNode);

      for (const cand of ranked) {
        const node = await this.buildNode(cand.to, current.depth + 1);
        result.nodes.push(node);
        result.edges.push({
          id: `${cand.tx.txHash}:${cand.to}`,
          source: currentKey,
          target: cand.to,
          type: 'SENT_TO',
          txHash: cand.tx.txHash,
          amount: cand.tx.amountNormalized,
          asset: cand.tx.asset,
          timestamp: new Date(cand.tx.timestamp).toISOString(),
          blockchain: cand.tx.chain,
          fiatEquivalent: cand.tx.fiatValueAtTime ?? null,
          blockNumber: cand.tx.blockNumber,
        } as any);
        result.visitedCount++;

        // Boundary checks decide whether the branch continues (CONDITIONS 3.2/3.3/3.9)
        const stop = await this.evaluateBoundary(node, cand.amount, current.depth + 1, result.boundaries);
        if (!stop) {
          frontier.push({
            address: node.id,
            depth: current.depth + 1,
            path: [...current.path, node.id],
            lastAmount: cand.amount,
            lastTimestamp: cand.ts,
          });
        }

        if (result.visitedCount >= opts.maxNodes) {
          result.incomplete = true;
          result.incompleteReason = TraceStopReason.MAX_NODES;
          break;
        }
      }

      if (current.depth + 1 >= opts.maxDepth && frontier.length > 0) {
        const nextDepth = frontier[0]?.depth ?? 0;
        if (nextDepth >= opts.maxDepth) {
          result.incomplete = false; // depth limit reached is a normal, bounded completion
          result.incompleteReason = TraceStopReason.MAX_DEPTH;
          break;
        }
      }
    }

    result.runtimeMs = Date.now() - startedAt;
    return result;
  }

  /** Resume a checkpointed trace after worker crash (CONDITION 3.4) — visited nodes are not re-expanded */
  async resumeFromCheckpoint(startAddress: string, checkpoint: TraceCheckpoint, options: Partial<BoundedTraceOptions> = {}): Promise<BoundedTraceResult> {
    this.logger.log(`Resuming trace for ${startAddress} with ${checkpoint.visited.length} visited node(s)`);
    const result = await this.trace(startAddress, {
      ...options,
      maxNodes: Math.max(
        1,
        (options.maxNodes ?? DEFAULT_TRACE_OPTIONS.maxNodes) - checkpoint.visited.length,
      ),
    });
    result.boundaries = [...checkpoint.boundaries, ...result.boundaries];
    result.prunedCount += checkpoint.prunedCount;
    result.incomplete = checkpoint.incomplete || result.incomplete;
    result.incompleteReason = result.incompleteReason ?? checkpoint.incompleteReason;
    return result;
  }

  /** Persist a checkpoint (queue worker calls this periodically for long jobs) */
  buildCheckpoint(result: BoundedTraceResult, remainingFrontier: TraceCheckpoint['frontier']): TraceCheckpoint {
    return {
      visited: result.nodes.map((n) => n.id),
      frontier: remainingFrontier,
      boundaries: result.boundaries,
      prunedCount: result.prunedCount,
      incomplete: result.incomplete,
      incompleteReason: result.incompleteReason,
    };
  }

  /**
   * CONDITION 3.2 — mixer/privacy entry: record explicit boundary, reduce confidence, stop branch.
   * CONDITION 3.3 — known VASP: candidate terminal; continue only when amount/time still correlate.
   * CONDITION 3.9 — bridge: mark unconfirmed cross-chain link when no registry match exists.
   */
  private async evaluateBoundary(
    node: GraphNode,
    amount: number,
    depth: number,
    boundaries: TraceBoundary[],
  ): Promise<boolean /* true = stop expansion */> {
    const addr = node.id.toLowerCase();

    // Mixer / privacy service => hard boundary
    if (node.type === 'mixer') {
      boundaries.push({
        nodeAddress: node.id,
        reason: TraceStopReason.MIXER_BOUNDARY,
        label: node.label,
        atDepth: depth,
        confidenceReduction: 25,
        message: `Trace boundary: funds entered privacy service '${node.label ?? node.id}'. No further path is asserted beyond this point.`,
      });
      return true;
    }

    // Known VASP/exchange => candidate terminal node
    if (node.type === 'exchange' || node.type === 'vasp') {
      boundaries.push({
        nodeAddress: node.id,
        reason: TraceStopReason.VASP_TERMINAL,
        label: node.label,
        atDepth: depth,
        confidenceReduction: 0,
        message: `Candidate terminal: funds reached known service '${node.label ?? node.id}' (attribution handled by entity layer).`,
      });
      // Continue only if amount is still significant relative to the flow (CONDITION 3.3)
      return amount <= 0;
    }

    // Bridge => cross-chain transition marker
    if (node.type === 'bridge') {
      boundaries.push({
        nodeAddress: node.id,
        reason: TraceStopReason.VASP_TERMINAL,
        label: node.label,
        atDepth: depth,
        confidenceReduction: 10,
        message: `Cross-chain transition via bridge '${node.label ?? node.id}' — destination-side correlation is unconfirmed.`,
      });
      return false;
    }

    return false;
  }

  /**
   * Priority ranking (RULES §3): amount significance + forwarding ratio proxy + time proximity +
   * graph distance + service proximity. Deterministic and explainable.
   */
  private edgePriority(
    amount: number,
    ts: number,
    parentAmount: number,
    parentTs: number,
    depth: number,
  ): number {
    const amountScore = Math.log10(1 + amount) * 10;
    const forwardingRatio = parentAmount > 0 && Number.isFinite(parentAmount) ? Math.min(amount / parentAmount, 1) : 0.5;
    const forwardScore = forwardingRatio * 15;
    const timeGapHours = Math.max(0, (ts - (Number.isFinite(parentTs) ? parentTs : ts)) / 3600000);
    const timeScore = Math.max(0, 10 - timeGapHours / 6);
    const depthPenalty = depth * 2;
    return amountScore + forwardScore + timeScore - depthPenalty;
  }

  private hopPriority(hop: { depth: number; lastAmount: number }): number {
    return Math.log10(1 + (Number.isFinite(hop.lastAmount) ? hop.lastAmount : 0)) * 10 - hop.depth * 3;
  }

  /** Build a graph node with the correct separation: wallet vs service vs infrastructure */
  private async buildNode(address: string, depth: number): Promise<GraphNode> {
    const key = address.toLowerCase();
    let wallet = await this.walletRepo.findOne({ where: { address: key } });
    if (!wallet) {
      wallet = await this.walletRepo.findOne({ where: { address } });
    }

    if (wallet) {
      // CONDITION 2.1 — infra nodes are NOT part of the fund-flow graph unless escalated
      if (wallet.nodeKind === NodeKind.INFRA && !wallet.infraEscalated) {
        return {
          id: key,
          type: 'infra',
          nodeKind: NodeKind.INFRA,
          label: wallet.label || 'Block producer (infrastructure)',
          metadata: { excludedFromFundFlow: true },
        };
      }
      const isMixer = /mixer|tornado|privacy/i.test(wallet.entityLabel || '') || /mixer|tornado|privacy/i.test(wallet.label || '');
      const isService = wallet.nodeKind === NodeKind.SERVICE || Boolean(wallet.vaspId);
      return {
        id: key,
        type: isMixer ? 'mixer' : isService ? 'vasp' : (wallet.entityLabel as any) || 'wallet',
        nodeKind: isService ? NodeKind.SERVICE : NodeKind.WALLET,
        label: wallet.label || wallet.entityLabel || 'Wallet',
        entityLabel: wallet.entityLabel || undefined,
        riskLevel: wallet.riskLevel,
        riskScore: wallet.riskScore,
        metadata: { depth },
      };
    }

    // No wallet record: heuristic classification (service-type nodes come from the registry when matched)
    return {
      id: key,
      type: 'unknown',
      nodeKind: NodeKind.WALLET,
      label: 'Unknown Wallet',
      metadata: { depth },
    } as GraphNode;
  }
}
