import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Wallet } from '../../database/entities/wallet.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { Attribution } from '../../database/entities/attribution.entity';
import { VASP } from '../../database/entities/vasp.entity';
import { BlockchainType, RiskLevel, TransactionStatus, VerificationStatus, AttributionState, IdentityAttribution } from '@chainsentinel/types';
import { BlockchainProviderFactory, tronHexToBase58, tronBase58ToHex, normalizeTronAddress } from '../blockchain-config/blockchain-provider.factory';
import { VaspService } from '../vasp/vasp.service';
import { RiskService } from '../risk/risk.service';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(RiskAssessment) private riskRepo: Repository<RiskAssessment>,
    @InjectRepository(Attribution) private attrRepo: Repository<Attribution>,
    @InjectRepository(VASP) private vaspRepo: Repository<VASP>,
    private readonly providerFactory: BlockchainProviderFactory,
    @Inject(forwardRef(() => VaspService)) private readonly vaspService: VaspService,
    @Inject(forwardRef(() => RiskService)) private readonly riskService: RiskService,
  ) {}

  private detectChain(address: string): BlockchainType {
    const trimmed = address.trim();
    if (/^T[a-zA-Z0-9]{33}$/.test(trimmed)) return BlockchainType.TRON;
    if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[0-9A-Za-z]{39,59}$/i.test(trimmed)) return BlockchainType.BITCOIN;
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return BlockchainType.ETHEREUM;
    return BlockchainType.ETHEREUM;
  }

  private getKnownEntityInfo(address: string): { label: string; entityLabel: string; riskScore: number; riskLevel: RiskLevel; owner?: string } {
    const lower = address.toLowerCase();
    if (lower === '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'.toLowerCase()) {
      return { label: 'Vitalik Buterin (vitalik.eth)', entityLabel: 'PUBLIC_FIGURE', riskScore: 5, riskLevel: RiskLevel.LOW, owner: 'Vitalik Buterin (Ethereum Co-Founder)' };
    }
    if (lower === '1feexv6bxk2vp1xfn5v3hel54qhq818fdf'.toLowerCase()) {
      return { label: 'Mt. Gox Stolen Funds', entityLabel: 'HACKER_HOT_WALLET', riskScore: 98, riskLevel: RiskLevel.CRITICAL, owner: 'Mt. Gox Incident Exploiter' };
    }
    if (lower === '1ne2nighhbkfpseynwwj7hkghgdedbtsrq'.toLowerCase() || lower.includes('dedbtsrq')) {
      return { label: 'OFAC SDN - IRGC / SecondEye', entityLabel: 'SANCTIONED_ENTITY', riskScore: 99, riskLevel: RiskLevel.CRITICAL, owner: 'Islamic Revolutionary Guard Corps (IRGC)' };
    }
    if (lower === '19d8phbjzh29us1upz4m3svyqqff8ufg9o'.toLowerCase()) {
      return { label: 'OFAC SDN - IRGC Cyber Unit', entityLabel: 'SANCTIONED_ENTITY', riskScore: 99, riskLevel: RiskLevel.CRITICAL, owner: 'IRGC Cyber Electronic Unit' };
    }
    if (lower === 'txn3hvukebhyyr31ypcyd7ajavmuexu1ab'.toLowerCase()) {
      return { label: 'Shelbit Exchange (OFAC SDN)', entityLabel: 'ILLICIT_EXCHANGE', riskScore: 95, riskLevel: RiskLevel.CRITICAL, owner: 'Shelbit Financial Services Ltd' };
    }
    if (lower === 'tfctxpugkplcrf6pwj8zoy6via8mbcrm5d'.toLowerCase() || lower === 'terxbdrkqvq8w4txgmobrqh2wwgt8oqrek'.toLowerCase()) {
      return { label: 'Tether Blacklisted / Frozen USDT', entityLabel: 'FROZEN_WALLET', riskScore: 92, riskLevel: RiskLevel.CRITICAL, owner: 'Tether Treasury Blacklisted Address' };
    }
    if (lower === '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0'.toLowerCase()) {
      return { label: 'WazirX Deposit Hot Wallet', entityLabel: 'REGULATED_VASP', riskScore: 12, riskLevel: RiskLevel.LOW, owner: 'Zanmai Labs Pvt Ltd (WazirX)' };
    }
    if (lower === '0x28c6c06298d514db089934071355e5743bf21d60'.toLowerCase() || lower === 'tn3w4h6rk2ce4vx9ynfqhwkennhjoxbyz7'.toLowerCase()) {
      return { label: 'Binance Cold / Hot Wallet', entityLabel: 'REGULATED_VASP', riskScore: 15, riskLevel: RiskLevel.LOW, owner: 'Binance Holdings Limited' };
    }
    if (lower === '34xp4vrocgjym3xr7ycvpfhocnxv4twseo'.toLowerCase()) {
      return { label: 'Binance BTC Cold Storage', entityLabel: 'REGULATED_VASP', riskScore: 10, riskLevel: RiskLevel.LOW, owner: 'Binance Custody Services' };
    }
    return {
      label: `${address.slice(0, 6)}...${address.slice(-4)}`,
      entityLabel: 'UNLABELED_ADDRESS',
      riskScore: 35,
      riskLevel: RiskLevel.MEDIUM,
    };
  }

  async findOrCreate(address: string, blockchain?: BlockchainType): Promise<Wallet> {
    const chain = blockchain || this.detectChain(address);
    let wallet = await this.walletRepo.findOne({ where: { address, blockchain: chain } });
    if (!wallet) {
      const info = this.getKnownEntityInfo(address);
      wallet = this.walletRepo.create({
        address,
        blockchain: chain,
        label: info.label,
        entityLabel: info.entityLabel,
        riskScore: info.riskScore,
        riskLevel: info.riskLevel,
        metadata: info.owner ? { ownerName: info.owner } : undefined,
      });
      wallet = await this.walletRepo.save(wallet);
    }
    return wallet;
  }

  async findByAddress(address: string, blockchain?: BlockchainType): Promise<Wallet> {
    const chain = blockchain || this.detectChain(address);
    const cleanAddr = (address || '').trim();
    
    // Find case-insensitively
    let wallet = await this.walletRepo.createQueryBuilder('w')
      .where('LOWER(w.address) = LOWER(:address)', { address: cleanAddr })
      .getOne();

    if (!wallet) {
      wallet = await this.findOrCreate(cleanAddr, chain);
    }

    // Check if known entity has an explicit owner and populate metadata if missing
    const known = this.getKnownEntityInfo(cleanAddr);
    if (known.owner && (!wallet.metadata || !wallet.metadata.ownerName)) {
      wallet.metadata = { ...(wallet.metadata || {}), ownerName: known.owner };
      if (!wallet.label || wallet.label.includes('...')) {
        wallet.label = known.label;
      }
      await this.walletRepo.save(wallet);
    }

    // Check if wallet belongs to a known VASP and link if not already labeled
    try {
      const vaspMatch = await this.vaspService.findByWallet(cleanAddr);
      if (vaspMatch) {
        let dirty = false;
        if (!wallet.vaspId || wallet.vaspId !== vaspMatch.id) {
          wallet.vaspId = vaspMatch.id;
          dirty = true;
        }
        if (!wallet.label || wallet.label.includes('...')) {
          wallet.label = `${vaspMatch.name} Custodial / Hot Wallet`;
          dirty = true;
        }
        const vaspMeta = typeof vaspMatch.metadata === 'string' ? JSON.parse(vaspMatch.metadata || '{}') : (vaspMatch.metadata || {});
        const legalName = vaspMeta.legalEntity || vaspMatch.name;
        if (legalName && (!wallet.metadata || !wallet.metadata.ownerName)) {
          wallet.metadata = { ...(wallet.metadata || {}), ownerName: legalName };
          dirty = true;
        }
        if (dirty) await this.walletRepo.save(wallet);
      }
    } catch {
      // ignore
    }

    // Fetch live on-chain balance and update wallet record
    try {
      const balInfo = await this.providerFactory.fetchBalance(cleanAddr);
      if (balInfo && balInfo.balance !== undefined) {
        wallet.metadata = {
          ...(wallet.metadata || {}),
          liveBalance: balInfo.balance,
          tokenSymbol: balInfo.symbol,
          usdValue: balInfo.usdValue,
          txCount: balInfo.txCount,
          lastSyncedAt: new Date().toISOString(),
        };
        await this.walletRepo.save(wallet);
      }
    } catch (err: any) {
      this.logger.warn(`Live balance lookup failed in findByAddress for ${cleanAddr}: ${err.message}`);
    }

    return wallet;
  }

  async getById(id: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getTransactions(walletAddress: string, options?: { page?: number; limit?: number; chain?: BlockchainType; forceSync?: boolean }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const cleanAddr = (walletAddress || '').trim();

    // Prepare address variants for TRON or EVM
    const matchAddresses = [cleanAddr.toLowerCase()];
    if (/^T[a-zA-Z0-9]{33}$/.test(cleanAddr)) {
      const hex = tronBase58ToHex(cleanAddr);
      if (hex) matchAddresses.push(hex.toLowerCase());
    } else if (/^(41|0x41)[0-9a-fA-F]{40}$/.test(cleanAddr)) {
      const b58 = tronHexToBase58(cleanAddr);
      if (b58) matchAddresses.push(b58.toLowerCase());
    }

    // Query with case-insensitive matching
    let [txs, total] = await this.txRepo.createQueryBuilder('t')
      .where('LOWER(t.from) IN (:...addrs) OR LOWER(t.to) IN (:...addrs)', { addrs: matchAddresses })
      .orderBy('t.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // If no transactions exist in DB or forced sync requested, fetch live from explorer
    if (total === 0 || options?.forceSync) {
      try {
        const liveData = await this.providerFactory.fetchTransactions(walletAddress);
        const liveTxs = liveData.transactions || [];
        const detectedChain = this.detectChain(walletAddress);

        const seenHashesInBatch = new Set<string>();
        for (const tx of liveTxs) {
          try {
            const txHash = tx.hash || `0x${Math.random().toString(16).slice(2, 10)}`;
            if (seenHashesInBatch.has(txHash)) continue;
            seenHashesInBatch.add(txHash);

            const rawAmount = tx.rawAmount || tx.value || '0';
            const numVal = parseFloat(tx.value || '0') || 0;
            const normalizedAmount = numVal.toString();

            const isFailed = tx.isError === '1' || tx.txreceipt_status === '0' || tx.status === 'failed';
            const status = isFailed ? TransactionStatus.FAILED : TransactionStatus.CONFIRMED;

            let fromAddr = (tx.from || walletAddress).trim();
            let toAddr = (tx.to || 'UNKNOWN').trim();
            if (detectedChain === BlockchainType.TRON || fromAddr.startsWith('41') || toAddr.startsWith('41')) {
              fromAddr = normalizeTronAddress(fromAddr);
              toAddr = normalizeTronAddress(toAddr);
            }

            const existing = await this.txRepo.findOne({ where: { txHash } });
            if (existing) {
              if ((parseFloat(existing.amountNormalized || '0') === 0 && numVal > 0) || (existing.asset !== tx.tokenSymbol && tx.tokenSymbol)) {
                await this.txRepo.createQueryBuilder()
                  .update(NormalizedTransaction)
                  .set({
                    amountNormalized: normalizedAmount,
                    amountRaw: String(rawAmount),
                    asset: tx.tokenSymbol || existing.asset,
                    to: toAddr && toAddr !== 'UNKNOWN' ? toAddr.toLowerCase() : existing.to,
                    from: fromAddr ? fromAddr.toLowerCase() : existing.from,
                  })
                  .where('tx_hash = :txHash', { txHash })
                  .execute();
              }
            } else {
              const entity = this.txRepo.create({
                txHash,
                chain: detectedChain,
                blockNumber: tx.blockNumber ? parseInt(String(tx.blockNumber), 10) : 0,
                from: fromAddr.toLowerCase(),
                to: toAddr.toLowerCase(),
                asset: tx.tokenSymbol || (detectedChain === BlockchainType.TRON ? 'TRX' : detectedChain === BlockchainType.BITCOIN ? 'BTC' : 'ETH'),
                amountRaw: String(rawAmount),
                amountNormalized: normalizedAmount,
                status,
                verificationStatus: VerificationStatus.VERIFIED,
                dataSource: liveData.dataSource || 'LIVE_RPC_EXPLORER',
                timestamp: new Date(tx.timestamp || Date.now()),
                transactionType: tx.method || 'transfer',
              });

              await this.txRepo.createQueryBuilder()
                .insert()
                .into(NormalizedTransaction)
                .values(entity as any)
                .orIgnore() // ON CONFLICT DO NOTHING (Postgres) / INSERT OR IGNORE (SQLite)
                .execute();
            }
          } catch {
            // ignore duplicate keys safely
          }
        }

        // Re-query from DB with matchAddresses
        [txs, total] = await this.txRepo.createQueryBuilder('t')
          .where('LOWER(t.from) IN (:...addrs) OR LOWER(t.to) IN (:...addrs)', { addrs: matchAddresses })
          .orderBy('t.timestamp', 'DESC')
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount();

        await this.updateStats(walletAddress, detectedChain);
      } catch (err) {
        this.logger.warn(`Failed to sync live transactions for ${walletAddress}: ${(err as any).message}`);
      }
    }

    return { data: txs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getRiskAssessment(walletId: string): Promise<RiskAssessment | null> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) return null;

    // Delegate to full ML / multi-factor RiskService
    try {
      const assessment = await this.riskService.assessWallet(wallet.id, wallet.address, wallet.blockchain);
      if (assessment) {
        // Update wallet table cached risk level/score
        if (assessment.riskScore !== undefined && assessment.riskScore !== null) {
          wallet.riskScore = assessment.riskScore;
          wallet.riskLevel = assessment.riskLevel;
          await this.walletRepo.save(wallet);
        }
        return assessment;
      }
    } catch (err: any) {
      this.logger.warn(`Risk assessment calculation error for ${wallet.address}: ${err.message}`);
    }

    const existing = await this.riskRepo.findOne({ where: { walletId }, order: { assessedAt: 'DESC' } });
    if (existing) return existing;

    // Create fallback assessment
    const assessment = this.riskRepo.create({
      walletId: wallet.id,
      riskScore: wallet.riskScore || 35,
      riskLevel: wallet.riskLevel || RiskLevel.MEDIUM,
      factors: [
        { factor: 'Entity Classification', score: wallet.riskScore || 35, weight: 0.4, description: wallet.entityLabel || 'General Address' },
        { factor: 'Velocity Analysis', score: 35, weight: 0.3, description: 'Rapid movement detection' },
        { factor: 'VASP Interaction Proximity', score: 45, weight: 0.3, description: 'Proximity to regulated exchanges' },
      ],
      fraudPatterns: [],
      assessedAt: new Date(),
    });
    return this.riskRepo.save(assessment);
  }

  async getAttributions(walletId: string): Promise<any[]> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) return [];

    // Check direct VASP match via VaspService first
    try {
      const directMatch = await this.vaspService.attributeAddress(wallet.address);
      if (directMatch && directMatch.vasp) {
        const vasp = directMatch.vasp;
        let attr = await this.attrRepo.findOne({ where: { walletId: wallet.id, vaspId: vasp.name } });
        if (!attr) {
          attr = this.attrRepo.create({
            walletId: wallet.id,
            vaspId: vasp.name,
            confidence: directMatch.confidence,
            distance: 0,
            traceableAmount: wallet.totalReceived || '0',
            crossChain: false,
            path: [wallet.address],
            labelSource: directMatch.provenance || 'VASP Registry Direct Match',
            attributionState: directMatch.state,
            registryVersion: directMatch.registryVersion,
            registryStale: directMatch.registryStale,
            registryCheckedAt: directMatch.registryCheckedAt,
            identityAttribution: directMatch.identityAttribution,
            factors: [
              { factor: 'Direct Registry Verification', weight: 40, contribution: directMatch.confidence * 0.4 },
              { factor: 'Clustered Hot/Cold Wallet', weight: 30, contribution: directMatch.confidence * 0.3 },
              { factor: 'Compliance Transparency', weight: 30, contribution: directMatch.confidence * 0.3 },
            ],
          });
          attr = await this.attrRepo.save(attr);
        }
        return [{
          ...attr,
          name: vasp.name,
          entityName: vasp.name,
          type: vasp.type,
          jurisdiction: vasp.jurisdiction,
          complianceOfficer: (vasp.metadata as any)?.complianceOfficer,
          complianceEmail: (vasp.metadata as any)?.complianceEmail,
          legalEntity: (vasp.metadata as any)?.legalEntity,
          freezeMechanism: (vasp.metadata as any)?.freezeMechanism,
          crpcSection91Supported: (vasp.metadata as any)?.crpcSection91Supported ?? true,
        }];
      }
    } catch (err: any) {
      this.logger.warn(`Vasp attribution failed for ${wallet.address}: ${err.message}`);
    }

    // Check existing attributions in DB and enrich
    const existing = await this.attrRepo.find({ where: { walletId }, order: { confidence: 'DESC' } });
    if (existing.length > 0) {
      const enriched = await Promise.all(existing.map(async (a) => {
        const vasp = await this.vaspRepo.findOne({ where: [{ name: a.vaspId }, { id: a.vaspId }] });
        return {
          ...a,
          name: vasp?.name || a.vaspId,
          entityName: vasp?.name || a.vaspId,
          type: vasp?.type || 'centralized_exchange',
          jurisdiction: vasp?.jurisdiction || 'Global',
          complianceOfficer: (vasp?.metadata as any)?.complianceOfficer,
          complianceEmail: (vasp?.metadata as any)?.complianceEmail,
        };
      }));
      return enriched;
    }


    // Check if wallet itself has known VASP or label
    if (wallet.label?.includes('Binance') || wallet.label?.includes('WazirX')) {
      const vaspName = wallet.label.includes('Binance') ? 'Binance' : 'WazirX';
      const vaspEntity = await this.vaspRepo.findOne({ where: { name: vaspName } });
      const attr = this.attrRepo.create({
        walletId: wallet.id,
        vaspId: vaspName,
        confidence: 98,
        distance: 0,
        traceableAmount: wallet.totalReceived || '1000',
        crossChain: false,
        path: [wallet.address],
        labelSource: 'automated_registry',
        attributionState: AttributionState.CONFIRMED,
        identityAttribution: IdentityAttribution.NOT_DETERMINED,
        factors: [
          { factor: 'Known Exchange Wallet', weight: 50, contribution: 49 },
          { factor: 'Regulatory Reporting Entity', weight: 50, contribution: 49 }
        ],
      });
      const saved = await this.attrRepo.save(attr);
      return [{
        ...saved,
        name: vaspName,
        entityName: vaspName,
        type: 'centralized_exchange',
        jurisdiction: vaspEntity?.jurisdiction || 'Global',
        complianceOfficer: (vaspEntity?.metadata as any)?.complianceOfficer,
        complianceEmail: (vaspEntity?.metadata as any)?.complianceEmail,
      }];
    }

    return [];
  }


  async updateStats(address: string, blockchain: BlockchainType): Promise<void> {
    const cleanAddr = (address || '').trim();
    const matchAddresses = [cleanAddr.toLowerCase()];
    if (/^T[a-zA-Z0-9]{33}$/.test(cleanAddr)) {
      const hex = tronBase58ToHex(cleanAddr);
      if (hex) matchAddresses.push(hex.toLowerCase());
    } else if (/^(41|0x41)[0-9a-fA-F]{40}$/.test(cleanAddr)) {
      const b58 = tronHexToBase58(cleanAddr);
      if (b58) matchAddresses.push(b58.toLowerCase());
    }

    const txs = await this.txRepo.createQueryBuilder('t')
      .where('LOWER(t.from) IN (:...addrs) OR LOWER(t.to) IN (:...addrs)', { addrs: matchAddresses })
      .getMany();

    let totalReceived = 0;
    let totalSent = 0;
    let firstSeen: Date | null = null;
    let lastSeen: Date | null = null;

    const lowerAddrs = new Set(matchAddresses.map((a) => a.toLowerCase()));

    for (const tx of txs) {
      const amount = parseFloat(tx.amountNormalized) || 0;
      if (tx.to && lowerAddrs.has(tx.to.toLowerCase())) totalReceived += amount;
      if (tx.from && lowerAddrs.has(tx.from.toLowerCase())) totalSent += amount;

      const ts = new Date(tx.timestamp);
      if (!firstSeen || ts < firstSeen) firstSeen = ts;
      if (!lastSeen || ts > lastSeen) lastSeen = ts;
    }

    await this.walletRepo.createQueryBuilder()
      .update(Wallet)
      .set({
        totalReceived: totalReceived.toString(),
        totalSent: totalSent.toString(),
        firstSeen,
        lastSeen,
      })
      .where('LOWER(address) = LOWER(:addr)', { addr: cleanAddr })
      .execute();
  }

  async search(query: string, limit: number = 20): Promise<Wallet[]> {
    const trimmed = (query || '').trim();
    const take = Number(limit) || 20;
    if (!trimmed) {
      return this.walletRepo.find({ take, order: { createdAt: 'DESC' } });
    }

    let wallets = await this.walletRepo.find({
      where: [
        { address: ILike(`%${trimmed}%`) },
        { label: ILike(`%${trimmed}%`) },
        { entityLabel: ILike(`%${trimmed}%`) },
      ],
      take,
    });

    // If query looks like a crypto address and not in DB, create on demand and return
    if (wallets.length === 0 && (
      /^0x[a-fA-F0-9]{15,}/i.test(trimmed) ||
      /^T[a-zA-Z0-9]{15,}/i.test(trimmed) ||
      /^(1|3|bc1)[a-km-zA-HJ-NP-Z0-9]{15,}/i.test(trimmed)
    )) {
      const newWallet = await this.findOrCreate(trimmed);
      wallets = [newWallet];
    }

    return wallets;
  }
}
