import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Neo4jService } from '../neo4j/neo4j.service';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { GraphData, GraphNode, GraphEdge, BlockchainType } from '@chainsentinel/types';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    private neo4j: Neo4jService,
  ) {}

  async buildGraphForAddress(address: string, blockchain: BlockchainType, depth: number = 3): Promise<GraphData> {
    const cleanAddr = (address || '').trim().toLowerCase();
    const maxDepth = Math.max(1, Math.min(depth || 3, 50));

    const addressSet = new Set<string>();
    addressSet.add(cleanAddr);

    let currentLayer = new Set<string>([cleanAddr]);
    const allTxs: NormalizedTransaction[] = [];
    const seenTxHashes = new Set<string>();

    for (let d = 0; d < maxDepth; d++) {
      if (currentLayer.size === 0) break;

      const layerAddrs = Array.from(currentLayer);
      const txs = await this.txRepo.createQueryBuilder('t')
        .where('(LOWER(t.from) IN (:...addrs) OR LOWER(t.to) IN (:...addrs)) AND t.chain = :blockchain', {
          addrs: layerAddrs,
          blockchain,
        })
        .orderBy('t.timestamp', 'DESC')
        .take(300)
        .getMany();

      const nextLayer = new Set<string>();
      for (const tx of txs) {
        if (!seenTxHashes.has(tx.txHash)) {
          seenTxHashes.add(tx.txHash);
          allTxs.push(tx);
        }

        const f = (tx.from || '').toLowerCase();
        const t = (tx.to || '').toLowerCase();
        if (f && !addressSet.has(f)) {
          addressSet.add(f);
          nextLayer.add(f);
        }
        if (t && !addressSet.has(t)) {
          addressSet.add(t);
          nextLayer.add(t);
        }
      }

      currentLayer = nextLayer;
      if (addressSet.size > 500) break; // keep layout responsive for large multi-hop graphs
    }

    // Find wallets in our database for these addresses
    const wallets = await this.walletRepo.createQueryBuilder('w')
      .where('LOWER(w.address) IN (:...addresses) AND w.blockchain = :blockchain', {
        addresses: Array.from(addressSet),
        blockchain,
      })
      .getMany();

    const walletMap = new Map(wallets.map((w) => [w.address.toLowerCase(), w]));

    const nodes: GraphNode[] = [];
    const nodeSet = new Set<string>();

    for (const addr of addressSet) {
      if (nodeSet.has(addr)) continue;
      nodeSet.add(addr);

      const wallet = walletMap.get(addr);
      const type = this.determineNodeType(addr, address, wallet);
      const ownerName = (wallet?.metadata as any)?.ownerName;

      nodes.push({
        id: addr,
        type,
        label: wallet?.label || wallet?.entityLabel || (ownerName ? `${ownerName} (${this.shortenAddress(addr)})` : this.shortenAddress(addr)),
        address: addr,
        blockchain,
        riskScore: wallet?.riskScore,
        riskLevel: wallet?.riskLevel,
        entityLabel: wallet?.entityLabel || undefined,
        balance: (wallet?.metadata as any)?.liveBalance || wallet?.totalReceived,
        totalReceived: wallet?.totalReceived,
        totalSent: wallet?.totalSent,
        firstSeen: wallet?.firstSeen?.toISOString(),
        lastSeen: wallet?.lastSeen?.toISOString(),
      });
    }

    const edges: GraphEdge[] = [];
    for (const tx of allTxs) {
      if (tx.from && tx.to) {
        edges.push({
          id: tx.id,
          source: tx.from.toLowerCase(),
          target: tx.to.toLowerCase(),
          type: 'SENT_TO',
          txHash: tx.txHash,
          amount: tx.amountNormalized,
          asset: tx.asset,
          timestamp: tx.timestamp instanceof Date ? tx.timestamp.toISOString() : String(tx.timestamp),
          blockchain: tx.chain,
          fiatEquivalent: tx.fiatValueAtTime,
          blockNumber: tx.blockNumber,
          status: tx.status,
          verificationStatus: tx.verificationStatus,
        } as any);
      }
    }

    // Also persist to Neo4j
    await this.persistGraphToNeo4j(address, blockchain, nodes, edges);

    return { nodes, edges };
  }

  async getCaseGraph(caseId: string): Promise<GraphData> {
    return this.neo4j.getCaseGraph(caseId);
  }

  async getWalletNeighbors(address: string, depth: number = 2) {
    return this.neo4j.getNeighbors(address, depth);
  }

  async traceForward(address: string, blockchain: BlockchainType, maxHops: number = 50): Promise<GraphData> {
    const visited = new Set<string>();
    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    const queue: Array<{ addr: string; depth: number }> = [{ addr: address, depth: 0 }];

    while (queue.length > 0) {
      const { addr, depth } = queue.shift()!;
      if (depth >= maxHops || visited.has(addr)) continue;
      visited.add(addr);

      const txs = await this.txRepo.find({
        where: { from: addr, chain: blockchain },
        order: { timestamp: 'DESC' },
        take: 50,
      });

      for (const tx of txs) {
        if (!tx.to) continue;

        if (!visited.has(tx.to)) {
          queue.push({ addr: tx.to, depth: depth + 1 });
          allNodes.push({
            id: tx.to,
            type: 'wallet',
            label: this.shortenAddress(tx.to),
            address: tx.to,
            blockchain,
          });
        }

        allEdges.push({
          id: tx.id,
          source: tx.from,
          target: tx.to,
          type: 'SENT_TO',
          txHash: tx.txHash,
          amount: tx.amountNormalized,
          asset: tx.asset,
          timestamp: tx.timestamp instanceof Date ? tx.timestamp.toISOString() : String(tx.timestamp),
          blockchain: tx.chain,
          fiatEquivalent: tx.fiatValueAtTime,
          blockNumber: tx.blockNumber,
        });
      }
    }

    // Add origin node
    allNodes.unshift({
      id: address,
      type: 'suspect',
      label: 'Origin',
      address,
      blockchain,
    });

    return { nodes: allNodes, edges: allEdges };
  }

  async traceBackward(address: string, blockchain: BlockchainType, maxHops: number = 50): Promise<GraphData> {
    const visited = new Set<string>();
    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    const queue: Array<{ addr: string; depth: number }> = [{ addr: address, depth: 0 }];

    while (queue.length > 0) {
      const { addr, depth } = queue.shift()!;
      if (depth >= maxHops || visited.has(addr)) continue;
      visited.add(addr);

      const txs = await this.txRepo.find({
        where: { to: addr, chain: blockchain },
        order: { timestamp: 'DESC' },
        take: 50,
      });

      for (const tx of txs) {
        if (!tx.from) continue;

        if (!visited.has(tx.from)) {
          queue.push({ addr: tx.from, depth: depth + 1 });
          allNodes.push({
            id: tx.from,
            type: 'wallet',
            label: this.shortenAddress(tx.from),
            address: tx.from,
            blockchain,
          });
        }

        allEdges.push({
          id: tx.id,
          source: tx.from,
          target: tx.to || addr,
          type: 'SENT_TO',
          txHash: tx.txHash,
          amount: tx.amountNormalized,
          asset: tx.asset,
          timestamp: tx.timestamp instanceof Date ? tx.timestamp.toISOString() : String(tx.timestamp),
          blockchain: tx.chain,
          fiatEquivalent: tx.fiatValueAtTime,
          blockNumber: tx.blockNumber,
        });
      }
    }

    allNodes.unshift({
      id: address,
      type: 'suspect',
      label: 'Target',
      address,
      blockchain,
    });

    return { nodes: allNodes, edges: allEdges };
  }

  async getStats() {
    const nodeCount = await this.neo4j.getNodeCount();
    const edgeCount = await this.neo4j.getEdgeCount();
    return { nodeCount, edgeCount };
  }

  private async persistGraphToNeo4j(
    originAddress: string,
    blockchain: BlockchainType,
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<void> {
    try {
      for (const node of nodes) {
        await this.neo4j.runQuery(
          `MERGE (n {address: $address})
           SET n.type = $type, n.label = $label, n.blockchain = $blockchain, n.riskScore = $riskScore
           SET n.caseId = $caseId`,
          {
            address: node.address || node.id,
            type: node.type,
            label: node.label,
            blockchain,
            riskScore: node.riskScore || 0,
            caseId: originAddress,
          },
        );
      }

      for (const edge of edges) {
        await this.neo4j.runQuery(
          `MATCH (a {address: $from}), (b {address: $to})
           MERGE (a)-[r:SENT_TO {txHash: $txHash}]->(b)
           SET r.amount = $amount, r.asset = $asset, r.timestamp = $timestamp,
               r.chain = $chain, r.blockNumber = $blockNumber`,
          {
            from: edge.source,
            to: edge.target,
            txHash: edge.txHash,
            amount: edge.amount,
            asset: edge.asset,
            timestamp: edge.timestamp,
            chain: edge.blockchain,
            blockNumber: edge.blockNumber,
          },
        );
      }
    } catch (error: any) {
      this.logger.warn(`Neo4j persistence error: ${error.message}`);
    }
  }

  private determineNodeType(address: string, suspectAddress: string, wallet?: Wallet): GraphNode['type'] {
    if (address === suspectAddress) return 'suspect';
    if (wallet?.entityLabel?.includes('exchange')) return 'exchange';
    if (wallet?.entityLabel?.includes('vasp')) return 'vasp';
    if (wallet?.entityLabel?.includes('dex')) return 'dex';
    if (wallet?.entityLabel?.includes('bridge')) return 'bridge';
    if (wallet?.entityLabel?.includes('mixer')) return 'mixer';
    if (wallet?.riskScore && wallet.riskScore > 80) return 'high_risk';
    return 'wallet';
  }

  private shortenAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
}
