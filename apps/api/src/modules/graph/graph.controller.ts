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
    @Query('depth') depth?: string,
  ) {
    if (!address) return { nodes: [], edges: [] };

    // Auto-detect blockchain if not provided
    let chain = blockchain as BlockchainType;
    if (!chain) {
      if (/^T[a-zA-Z1-9]{33}$/.test(address)) chain = BlockchainType.TRON;
      else if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/.test(address)) chain = BlockchainType.BITCOIN;
      else chain = BlockchainType.ETHEREUM;
    }

    const depthNum = parseInt(depth || '2', 10) || 2;

    // First try to build from real DB transactions
    const dbGraph = await this.graphService.buildGraphForAddress(address, chain, depthNum);

    if (dbGraph.nodes.length > 1) {
      // Ensure edges have token for UI rendering
      const enrichedEdges = dbGraph.edges.map((e: any) => ({
        ...e,
        token: e.token || e.asset || 'ETH',
      }));
      return { ...dbGraph, edges: enrichedEdges, dataSource: 'DATABASE', providerName: 'Postgres Cache' };
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
    if (lower === '0x28c6c06298d514db089934071355e5743bf21d60') return 'Binance Cold Storage (14)';
    if (lower === 'tn3w4h6rk2ce4vx9ynfqhwkennhjoxbyz7'.toLowerCase()) return 'Binance TRON Hot Wallet';
    if (lower === 'txn3hvukebhyyr31ypcyd7ajavmuexu1ab'.toLowerCase()) return 'Shelbit Exchange (OFAC SDN)';
    if (lower === '19d8phbjzh29us1upz4m3svyqqff8ufg9o'.toLowerCase()) return 'IRGC Cyber Unit Cluster';
    if (lower === '1ne2nighhbkfpseynwwj7hkghgdedbtsrq'.toLowerCase()) return 'OFAC Sanctioned Ransomware Address';
    if (lower === '1feexv6bxk2vp1xfn5v3hel54qhq818fdf'.toLowerCase()) return 'Mt. Gox Exploiter Wallet';
    if (lower === '34xp4vrocgjym3xr7ycvpfhocnxv4twseo'.toLowerCase()) return 'Binance BTC Cold Storage';
    if (lower === '0xd8da6bf26964af9d7eed9e03e53415d37aa96045') return 'Vitalik Buterin (vitalik.eth)';
    if (lower === '0xdac17f958d2ee523a2206206994597c13d831ec7') return 'Tether USD (USDT) Contract';
    if (lower === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') return 'USD Coin (USDC) Contract';
    if (lower.includes('tornado') || lower === '0x8589427373d6d84e98730d7795d8f6f8731fda16' || lower === '0x722122df12d45705f05842c392bb55e76144aefa') return 'Tornado Cash Mixer';
    if (lower.includes('uniswap') || lower === '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45' || lower === '0xe592427a0aece92de3edee1f18e0157c05861564') return 'Uniswap V3 Router';
    if (lower.includes('thor') || lower === '0x39aC22b2063B9c64A4fC2d00b26cCcC5271Bd31B'.toLowerCase()) return 'THORChain / Axelar Bridge';
    if (lower.includes('stargate') || lower === '0xdf0770df86a8034b3efef0a1bb3c889b8332ff56'.toLowerCase()) return 'Stargate / LayerZero Bridge';
    if (lower.includes('lido') || lower === '0xae7ab96520de3a18e5e111b5eaab095312d7fe84') return 'Lido Staked ETH Pool';
    if (lower.includes('foundry') || lower.includes('antpool') || lower.includes('f2pool')) return 'Mining Pool Operator';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private guessType(address: string): string {
    const lower = address.toLowerCase();
    if (
      lower === '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0' ||
      lower === '0x28c6c06298d514db089934071355e5743bf21d60' ||
      lower === 'tn3w4h6rk2ce4vx9ynfqhwkennhjoxbyz7'.toLowerCase() ||
      lower === '34xp4vrocgjym3xr7ycvpfhocnxv4twseo'.toLowerCase()
    ) return 'exchange';
    if (
      lower === 'txn3hvukebhyyr31ypcyd7ajavmuexu1ab'.toLowerCase() ||
      lower === '19d8phbjzh29us1upz4m3svyqqff8ufg9o'.toLowerCase() ||
      lower === '1ne2nighhbkfpseynwwj7hkghgdedbtsrq'.toLowerCase() ||
      lower === '1feexv6bxk2vp1xfn5v3hel54qhq818fdf'.toLowerCase()
    ) return 'high_risk';
    if (lower.includes('tornado') || lower === '0x8589427373d6d84e98730d7795d8f6f8731fda16' || lower === '0x722122df12d45705f05842c392bb55e76144aefa') return 'mixer';
    if (lower.includes('uniswap') || lower === '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45' || lower === '0xe592427a0aece92de3edee1f18e0157c05861564') return 'dex';
    if (lower.includes('thor') || lower.includes('stargate') || lower.includes('bridge') || lower === '0x39aC22b2063B9c64A4fC2d00b26cCcC5271Bd31B'.toLowerCase()) return 'bridge';
    if (lower.includes('lido') || lower.includes('validator') || lower.includes('miner') || lower.includes('pool')) return 'miner';
    return 'wallet';
  }
}
