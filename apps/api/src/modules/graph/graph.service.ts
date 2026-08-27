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
    const txs = await this.txRepo.find({
      where: [
        { from: address, chain: blockchain },
        { to: address, chain: blockchain },
      ],
      order: { timestamp: 'DESC' },
      take: 500,
    });

    const addressSet = new Set<string>();
    addressSet.add(address);

    for (const tx of txs) {
      if (tx.from) addressSet.add(tx.from);
      if (tx.to) addressSet.add(tx.to);
    }

    // Find wallets in our database for these addresses
    const wallets = await this.walletRepo.find({
      where: Array.from(addressSet).map((addr) => ({ address: addr, blockchain })),
    });

    const walletMap = new Map(wallets.map((w) => [w.address, w]));

    const nodes: GraphNode[] = [];
    const nodeSet = new Set<string>();

    for (const addr of addressSet) {
      if (nodeSet.has(addr)) continue;
      nodeSet.add(addr);

      const wallet = walletMap.get(addr);
      const type = this.determineNodeType(addr, address, wallet);

      nodes.push({
        id: addr,
        type,
        label: wallet?.label || wallet?.entityLabel || this.shortenAddress(addr),
        address: addr,
        blockchain,
        riskScore: wallet?.riskScore,
        riskLevel: wallet?.riskLevel,
        entityLabel: wallet?.entityLabel || undefined,
        balance: wallet?.totalReceived,
        totalReceived: wallet?.totalReceived,
        totalSent: wallet?.totalSent,
        firstSeen: wallet?.firstSeen?.toISOString(),
        lastSeen: wallet?.lastSeen?.toISOString(),
      });
    }

    const edges: GraphEdge[] = [];
    for (const tx of txs) {
      if (tx.from && tx.to) {
        edges.push({
          id: tx.id,
          source: tx.from,
          target: tx.to || '',
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

  async traceForward(address: string, blockchain: BlockchainType, maxHops: number = 10): Promise<GraphData> {
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

  async traceBackward(address: string, blockchain: BlockchainType, maxHops: number = 10): Promise<GraphData> {
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
