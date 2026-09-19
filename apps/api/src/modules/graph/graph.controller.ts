import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GraphService } from './graph.service';
import { AddressClassifierService } from './address-classifier.service';
import { BlockchainProviderFactory } from '../blockchain-config/blockchain-provider.factory';
import { BlockchainType } from '@chainsentinel/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Graph')
@Controller('graph')
export class GraphController {
  constructor(
    private readonly providerFactory: BlockchainProviderFactory,
    private readonly graphService: GraphService,
    private readonly classifier: AddressClassifierService,
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

    // Clear stale in-memory classification cache for this new trace
    this.classifier.clearCache();

    // First try to build from real DB transactions
    const dbGraph = await this.graphService.buildGraphForAddress(address, chain, depthNum);

    if (dbGraph.nodes.length > 1) {
      // Reclassify any nodes that are generic 'wallet' or stale 'high_risk' from old cache
      // We throttle to 5 parallel requests every 250ms to stay within Etherscan's free tier (5 req/sec)
      const needsClassification = dbGraph.nodes.filter((node: any) =>
        chain === BlockchainType.ETHEREUM &&
        /^0x[0-9a-fA-F]{40}$/.test(node.id) &&
        (!node.type || node.type === 'wallet' || node.type === 'high_risk')
      );

      const classificationMap = new Map<string, { type: string; label: string }>();
      for (let i = 0; i < needsClassification.length; i += 5) {
        const batch = needsClassification.slice(i, i + 5);
        await Promise.all(
          batch.map(async (node: any) => {
            const result = await this.classifier.classify(node.id, node.riskScore);
            classificationMap.set(node.id, result);
          })
        );
        if (i + 5 < needsClassification.length) await new Promise(r => setTimeout(r, 220));
      }

      const classifiedNodes = dbGraph.nodes.map((node: any) => {
        const classified = classificationMap.get(node.id);
        if (!classified) return node;
        return {
          ...node,
          type: classified.type,
          label: node.label && !node.label.startsWith('0x') ? node.label : classified.label,
        };
      });

      const enrichedEdges = dbGraph.edges.map((e: any) => ({
        ...e,
        token: e.token || e.asset || 'ETH',
      }));
      return { ...dbGraph, nodes: classifiedNodes, edges: enrichedEdges, dataSource: 'DATABASE', providerName: 'Postgres Cache' };
    }

    // No DB data yet — fetch live from the configured provider
    const txData = await this.providerFactory.fetchTransactions(address);
    const txs: any[] = [...(txData.transactions || [])];

    // If multi-hop tracing is requested (depth >= 2), expand the top counterparties live!
    if (depthNum >= 2 && txs.length > 0) {
      const suspectLower = address.toLowerCase();
      const topCounterparties = Array.from(new Set(
        txs.map(t => (t.to?.toLowerCase() !== suspectLower ? t.to : t.from)?.toLowerCase()).filter(Boolean)
      )).slice(0, 3);

      for (const cp of topCounterparties) {
        if (!cp || cp === suspectLower) continue;
        try {
          await new Promise(r => setTimeout(r, 250)); // throttle to stay within 5 req/sec
          const subData = await this.providerFactory.fetchTransactions(cp);
          if (subData.transactions?.length) {
            txs.push(...subData.transactions.slice(0, 15));
          }
        } catch {
          // continue if a sub-counterparty fails
        }
      }
    }

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

    // Known mixer pools (Tornado Cash, etc.)
    const mixerAddresses = new Set([
      '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
      '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
      '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf',
      '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
      '0x080e122323db33321528c7452915309d8a947e77',
      '0xb9244a72088f11ecfdb75c0c2d26f6345851493',
    ]);

    // Detect mixer feeders (wallets transferring funds directly into mixers)
    const mixerFeeders = new Set<string>();
    for (const tx of txs) {
      const to = (tx.to || '').toLowerCase();
      const from = (tx.from || '').toLowerCase();
      if (mixerAddresses.has(to) && from && from !== suspectKey) {
        mixerFeeders.add(from);
      }
    }

    // Classify all counterparty addresses in parallel (batched to avoid rate limits)
    const counterparties = new Set<string>();
    for (const tx of txs) {
      const from = (tx.from || '').toLowerCase();
      const to = (tx.to || '').toLowerCase();
      if (from && from !== suspectKey) counterparties.add(from);
      if (to && to !== suspectKey) counterparties.add(to);
    }

    // Classify in parallel (Etherscan free tier: 5 req/sec — batch with small delay)
    const classificationMap = new Map<string, { type: string; label: string }>();
    const counterpartyArr = Array.from(counterparties);
    
    for (let i = 0; i < counterpartyArr.length; i++) {
      const addr = counterpartyArr[i];
      if (mixerFeeders.has(addr)) {
        classificationMap.set(addr, {
          type: 'high_risk',
          label: `High-Risk Mixer Feeder (${addr.slice(0, 6)}...${addr.slice(-4)})`,
        });
        continue;
      }
      // Only classify Ethereum addresses dynamically
      if (chain === BlockchainType.ETHEREUM && /^0x[0-9a-fA-F]{40}$/.test(addr)) {
        const result = await this.classifier.classify(addr);
        if (result.type === 'mixer') {
          mixerAddresses.add(addr);
        }
        classificationMap.set(addr, result);
        // Tiny delay every 5 requests to stay within free rate limit
        if (i > 0 && i % 5 === 0) await new Promise((r) => setTimeout(r, 250));
      } else {
        classificationMap.set(addr, {
          type: 'wallet',
          label: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
        });
      }
    }

    // Re-check any counterparties that send to newly discovered mixers
    for (const tx of txs) {
      const to = (tx.to || '').toLowerCase();
      const from = (tx.from || '').toLowerCase();
      if (mixerAddresses.has(to) && from && from !== suspectKey && !classificationMap.get(from)?.type?.includes('mixer')) {
        classificationMap.set(from, {
          type: 'high_risk',
          label: `High-Risk Mule (${from.slice(0, 6)}...${from.slice(-4)})`,
        });
      }
    }

    for (const tx of txs) {
      const from = (tx.from || '').toLowerCase();
      const to = (tx.to || '').toLowerCase();
      if (!from || !to) continue;

      if (!nodesMap.has(from)) {
        const info = classificationMap.get(from) ?? { type: 'wallet', label: `${from.slice(0, 6)}...${from.slice(-4)}` };
        nodesMap.set(from, { id: from, label: info.label, type: info.type, address: from });
      }
      if (!nodesMap.has(to)) {
        const info = classificationMap.get(to) ?? { type: 'wallet', label: `${to.slice(0, 6)}...${to.slice(-4)}` };
        nodesMap.set(to, { id: to, label: info.label, type: info.type, address: to });
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
}
