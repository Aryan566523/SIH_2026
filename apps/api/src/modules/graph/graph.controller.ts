import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { BlockchainProviderFactory } from '../blockchain-config/blockchain-provider.factory';
import { BlockchainType } from '@chainsentinel/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Graph')
@Controller('graph')
export class GraphController {
  constructor(
    private readonly providerFactory: BlockchainProviderFactory,
    private readonly graphService: GraphService,
  ) {}

  /**
   * Primary endpoint: fetches real stored transactions from Postgres
   * and builds a graph. Falls back to live API fetch if address not in DB yet.
   */
  @UseGuards(JwtAuthGuard)
  @Get('trace')
  async traceAddress(
    @Query('address') address: string,
    @Query('blockchain') blockchain?: string,
  ) {
    if (!address) return { nodes: [], edges: [] };

    // Auto-detect blockchain if not provided
    let chain = blockchain as BlockchainType;
    if (!chain) {
      if (/^T[a-zA-Z1-9]{33}$/.test(address)) chain = BlockchainType.TRON;
      else if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/.test(address)) chain = BlockchainType.BITCOIN;
      else chain = BlockchainType.ETHEREUM;
    }

    // First try to build from real DB transactions
    const dbGraph = await this.graphService.buildGraphForAddress(address, chain);

    if (dbGraph.nodes.length > 1) {
      // We have real data — return it
      return dbGraph;
    }

    // No DB data yet — fetch live from the configured provider and build in-memory graph
    const txData = await this.providerFactory.fetchTransactions(address);
    const txs = txData.transactions || [];

    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    const suspectKey = address.toLowerCase();
    nodesMap.set(suspectKey, {
      id: suspectKey,
      label: 'Suspect Wallet',
      type: 'suspect',
      address: suspectKey,
      dataSource: txData.dataSource,
    });

    for (const tx of txs) {
      const from = (tx.from || '').toLowerCase();
      const to = (tx.to || '').toLowerCase();
      if (!from || !to) continue;

      if (!nodesMap.has(from)) {
        nodesMap.set(from, {
          id: from,
          label: this.guessLabel(from),
          type: this.guessType(from),
          address: from,
        });
      }
      if (!nodesMap.has(to)) {
        nodesMap.set(to, {
          id: to,
          label: this.guessLabel(to),
          type: this.guessType(to),
          address: to,
        });
      }

      const rawAmount = tx.value || tx.amount || '0';
      const numVal = parseFloat(rawAmount) || 0;
      let normalizedAmount = numVal.toString();
      if (numVal > 1e14) {
        normalizedAmount = (numVal / 1e18).toFixed(4);
      } else if (numVal > 1e8 && chain === BlockchainType.TRON) {
        normalizedAmount = (numVal / 1e6).toFixed(2);
      } else if (numVal > 0) {
        normalizedAmount = numVal < 0.0001 ? numVal.toExponential(2) : numVal.toFixed(4);
      }

      edges.push({
        source: from,
        target: to,
        amount: normalizedAmount,
        token: tx.tokenSymbol || (chain === BlockchainType.TRON ? 'TRX' : chain === BlockchainType.BITCOIN ? 'BTC' : 'ETH'),
        txHash: tx.hash || tx.txHash,
        timestamp: tx.timeStamp ? new Date(parseInt(tx.timeStamp) * 1000).toISOString() : tx.timestamp || new Date().toISOString(),
      });
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges,
      dataSource: txData.dataSource,
      providerName: txData.providerName,
    };
  }

  private guessLabel(address: string): string {
    const lower = address.toLowerCase();
    if (lower === '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0') return 'WazirX Hot Wallet';
    if (lower === '0x28c6c06298d514db089934071355e5743bf21d60') return 'Binance Cold Wallet';
    if (lower === 'tn3w4h6rk2ce4vx9ynfqhwkennhjoxbyz7'.toLowerCase()) return 'Binance TRON Hot Wallet';
    if (lower === 'txn3hvukebhyyr31ypcyd7ajavmuexu1ab'.toLowerCase()) return 'Shelbit Exchange (OFAC SDN)';
    if (lower === '19d8phbjzh29us1upz4m3svyqqff8ufg9o'.toLowerCase()) return 'IRGC High-Risk Cluster';
    if (lower === '34xp4vrocgjym3xr7ycvpfhocnxv4twseo'.toLowerCase()) return 'Binance BTC Cold Storage';
    if (lower.includes('tornado')) return 'Tornado Cash Mixer';
    if (lower.includes('uniswap')) return 'Uniswap V3 DEX';
    if (lower.includes('thor')) return 'THORChain Bridge';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private guessType(address: string): string {
    const lower = address.toLowerCase();
    if (lower === '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0' || lower === '0x28c6c06298d514db089934071355e5743bf21d60' || lower === 'tn3w4h6rk2ce4vx9ynfqhwkennhjoxbyz7'.toLowerCase() || lower === '34xp4vrocgjym3xr7ycvpfhocnxv4twseo'.toLowerCase()) return 'exchange';
    if (lower === 'txn3hvukebhyyr31ypcyd7ajavmuexu1ab'.toLowerCase() || lower === '19d8phbjzh29us1upz4m3svyqqff8ufg9o'.toLowerCase()) return 'high_risk';
    if (lower.includes('tornado')) return 'mixer';
    if (lower.includes('uniswap')) return 'dex';
    if (lower.includes('thor')) return 'bridge';
    return 'wallet';
  }
}
