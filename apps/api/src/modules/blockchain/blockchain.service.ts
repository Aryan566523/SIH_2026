import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { BlockchainType, Transaction, Balance, QueryOptions, TokenTransfer, Block } from '@chainsentinel/types';

// Provider manager with fallback
class ProviderManager {
  private providers: Map<string, any> = new Map();
  private healthStatus: Map<string, boolean> = new Map();

  addProvider(name: string, provider: any) {
    this.providers.set(name, provider);
    this.healthStatus.set(name, true);
  }

  async executeWithFallback<T>(fn: (provider: any) => Promise<T>): Promise<T> {
    const errors: Error[] = [];
    for (const [name, provider] of this.providers) {
      if (!this.healthStatus.get(name)) continue;
      try {
        return await fn(provider);
      } catch (error: any) {
        errors.push(error);
        this.healthStatus.set(name, false);
        setTimeout(() => this.healthStatus.set(name, true), 60000); // Re-enable after 60s
      }
    }
    throw new Error(`All providers failed: ${errors.map((e) => e.message).join(', ')}`);
  }
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private providerManager = new ProviderManager();
  private providerManagerMap: Map<BlockchainType, ProviderManager> = new Map();

  constructor(
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    private configService: ConfigService,
  ) {
    this.initProviders();
  }

  private initProviders() {
    // Ethereum providers
    const ethManager = new ProviderManager();
    const ethKey = this.configService.get('ALCHEMY_API_KEY');
    if (ethKey) {
      ethManager.addProvider('alchemy', { type: 'alchemy', key: ethKey });
    }
    const infuraKey = this.configService.get('INFURA_API_KEY');
    if (infuraKey) {
      ethManager.addProvider('infura', { type: 'infura', key: infuraKey });
    }
    this.providerManagerMap.set(BlockchainType.ETHEREUM, ethManager);

    // Tron providers
    const tronManager = new ProviderManager();
    const tronKey = this.configService.get('TRONGRID_API_KEY');
    if (tronKey) {
      tronManager.addProvider('trongrid', { type: 'trongrid', key: tronKey });
    }
    this.providerManagerMap.set(BlockchainType.TRON, tronManager);
  }

  // Detect blockchain from address format
  detectChain(address: string): BlockchainType {
    if (!address) return BlockchainType.UNKNOWN;

    // Ethereum/EVM: 0x + 40 hex chars
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) return BlockchainType.ETHEREUM;

    // Tron: T + 33 base58 chars
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return BlockchainType.TRON;

    // Bitcoin: legacy (1/3), bech32 (bc1)
    if (/^(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) || /^bc1[0-9a-z]{25,90}$/.test(address)) {
      return BlockchainType.BITCOIN;
    }

    return BlockchainType.UNKNOWN;
  }

  // Validate address
  validateAddress(address: string, chain: BlockchainType): boolean {
    switch (chain) {
      case BlockchainType.ETHEREUM:
      case BlockchainType.POLYGON:
      case BlockchainType.BNB_CHAIN:
      case BlockchainType.ARBITRUM:
      case BlockchainType.OPTIMISM:
        return /^0x[0-9a-fA-F]{40}$/.test(address);
      case BlockchainType.TRON:
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
      case BlockchainType.BITCOIN:
        return /^(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) || /^bc1[0-9a-z]{25,90}$/.test(address);
      default:
        return false;
    }
  }

  // Get transactions (demo/seed mode when no provider configured)
  async getTransactions(
    address: string,
    chain: BlockchainType,
    options?: QueryOptions,
  ): Promise<NormalizedTransaction[]> {
    // Check if we have cached/ingested data first
    const existing = await this.txRepo.find({
      where: [
        { from: address, chain },
        { to: address, chain },
      ],
      order: { timestamp: 'DESC' },
      take: options?.limit || 100,
    });

    if (existing.length > 0) {
      return existing;
    }

    // If no provider configured, return empty
    this.logger.warn(`No blockchain provider configured for ${chain}. Returning empty results.`);
    return [];
  }

  // Ingest and normalize transactions
  async ingestTransactions(
    address: string,
    chain: BlockchainType,
    rawTxs: any[],
  ): Promise<NormalizedTransaction[]> {
    const normalized: NormalizedTransaction[] = [];

    for (const tx of rawTxs) {
      const normalizedTx = this.normalizeTransaction(tx, chain);
      if (normalizedTx) {
        // Upsert - check if exists
        const existing = await this.txRepo.findOne({ where: { txHash: normalizedTx.txHash } });
        if (!existing) {
          try {
            await this.txRepo.createQueryBuilder()
              .insert()
              .into(NormalizedTransaction)
              .values(normalizedTx as any)
              .orIgnore()
              .execute();
            const saved = await this.txRepo.findOne({ where: { txHash: normalizedTx.txHash } });
            if (saved) normalized.push(saved);
          } catch {
            // Ignore duplicate key collision safely
          }
        }
      }
    }

    this.logger.log(`Ingested ${normalized.length} transactions for ${address} on ${chain}`);
    return normalized;
  }

  private normalizeTransaction(raw: any, chain: BlockchainType): Partial<NormalizedTransaction> | null {
    try {
      const from = raw.from || raw.sender || '';
      const to = raw.to || raw.receiver || null;
      const value = raw.value || raw.amount || '0';
      const decimals = raw.decimals || 18;

      return {
        chain,
        txHash: raw.hash || raw.txHash || raw.txID,
        blockNumber: raw.blockNumber || raw.block_height || 0,
        timestamp: new Date((raw.timestamp || raw.time || Date.now()) * 1000),
        from,
        to,
        asset: raw.symbol || raw.asset || 'ETH',
        tokenContract: raw.contractAddress || raw.token_address || null,
        amountRaw: value.toString(),
        amountNormalized: (parseFloat(value) / Math.pow(10, decimals)).toString(),
        status: (raw.status === 'success' || raw.status === 1 ? 'confirmed' : 'pending') as any,
        transactionType: raw.method || 'transfer',
      };
    } catch (error: any) {
      this.logger.warn(`Failed to normalize transaction: ${error.message}`);
      return null;
    }
  }

  async getBalance(address: string, chain: BlockchainType): Promise<Balance[]> {
    // In production, call actual provider
    return [{ asset: 'ETH', amount: '0', contractAddress: null, symbol: 'ETH', decimals: 18 }];
  }
}
