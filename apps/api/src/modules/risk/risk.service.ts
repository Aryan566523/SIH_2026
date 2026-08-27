import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { RiskLevel } from '@chainsentinel/types';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    @InjectRepository(RiskAssessment) private riskRepo: Repository<RiskAssessment>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
  ) {}

  async assessWallet(walletId: string, walletAddress: string, chain: string): Promise<RiskAssessment> {
    const factors: Array<{ factor: string; score: number; weight: number; description: string }> = [];
    let totalScore = 0;

    // Get transaction history
    const txs = await this.txRepo.find({
      where: [
        { from: walletAddress, chain: chain as any },
        { to: walletAddress, chain: chain as any },
      ],
    });

    // Factor 1: Transaction velocity
    const recentTxs = txs.filter(
      (tx) => new Date(tx.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000,
    );
    const velocityScore = Math.min(recentTxs.length * 5, 25);
    if (velocityScore > 0) {
      factors.push({
        factor: 'Transaction Velocity',
        score: velocityScore,
        weight: 25,
        description: `${recentTxs.length} transactions in the last 24 hours`,
      });
      totalScore += velocityScore;
    }

    // Factor 2: Rapid forwarding
    const rapidForwardCount = this.detectRapidForwarding(txs, walletAddress);
    const rapidScore = Math.min(rapidForwardCount * 8, 20);
    if (rapidScore > 0) {
      factors.push({
        factor: 'Rapid Forwarding',
        score: rapidScore,
        weight: 20,
        description: `${rapidForwardCount} instances of funds received and forwarded quickly`,
      });
      totalScore += rapidScore;
    }

    // Factor 3: Large amount exposure
    const maxAmount = txs.reduce((max, tx) => Math.max(max, parseFloat(tx.amountNormalized) || 0), 0);
    const amountScore = maxAmount > 100000 ? 15 : maxAmount > 10000 ? 10 : maxAmount > 1000 ? 5 : 0;
    if (amountScore > 0) {
      factors.push({
        factor: 'High Value Activity',
        score: amountScore,
        weight: 15,
        description: `Maximum single transaction: ${maxAmount.toLocaleString()}`,
      });
      totalScore += amountScore;
    }

    // Factor 4: Cross-chain activity
    const chains = new Set(txs.map((tx) => tx.chain));
    if (chains.size > 1) {
      const crossChainScore = Math.min(chains.size * 5, 15);
      factors.push({
        factor: 'Cross-Chain Activity',
        score: crossChainScore,
        weight: 15,
        description: `Active on ${chains.size} different blockchains`,
      });
      totalScore += crossChainScore;
    }

    // Factor 5: Wallet age
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (wallet?.firstSeen) {
      const ageDays = (Date.now() - new Date(wallet.firstSeen).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 7) {
        const ageScore = 15;
        factors.push({
          factor: 'New Wallet',
          score: ageScore,
          weight: 15,
          description: `Wallet created ${Math.floor(ageDays)} days ago`,
        });
        totalScore += ageScore;
      }
    }

    // Factor 6: Unique counterparties
    const counterparties = new Set<string>();
    txs.forEach((tx) => {
      if (tx.from !== walletAddress) counterparties.add(tx.from);
      if (tx.to && tx.to !== walletAddress) counterparties.add(tx.to);
    });
    if (counterparties.size > 20) {
      const cpScore = 10;
      factors.push({
        factor: 'Many Counterparties',
        score: cpScore,
        weight: 10,
        description: `Interacted with ${counterparties.size} unique addresses`,
      });
      totalScore += cpScore;
    }

    totalScore = Math.min(totalScore, 100);

    const riskLevel = totalScore >= 80 ? RiskLevel.CRITICAL
      : totalScore >= 60 ? RiskLevel.HIGH
      : totalScore >= 40 ? RiskLevel.MEDIUM
      : RiskLevel.LOW;

    const fraudPatterns = this.detectFraudPatterns(txs, walletAddress);

    const assessment = this.riskRepo.create({
      walletId,
      riskScore: totalScore,
      riskLevel,
      factors,
      fraudPatterns,
      assessedAt: new Date(),
    });

    const saved = await this.riskRepo.save(assessment);

    // Update wallet risk
    await this.walletRepo.update(walletId, { riskScore: totalScore, riskLevel });

    return saved;
  }

  private detectRapidForwarding(txs: any[], address: string): number {
    let count = 0;
    const received = txs.filter((tx) => tx.to === address).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    for (const recv of received) {
      const sentAfter = txs.find(
        (tx) =>
          tx.from === address &&
          tx.to !== address &&
          new Date(tx.timestamp).getTime() > new Date(recv.timestamp).getTime() &&
          new Date(tx.timestamp).getTime() - new Date(recv.timestamp).getTime() < 30 * 60 * 1000, // 30 min
      );
      if (sentAfter) count++;
    }

    return count;
  }

  private detectFraudPatterns(txs: any[], address: string) {
    const patterns: Array<{ patternType: string; confidence: number; riskContribution: number; description: string }> = [];

    // Fan-out detection
    const sentTxs = txs.filter((tx) => tx.from === address);
    const uniqueDestinations = new Set(sentTxs.map((tx) => tx.to));
    if (uniqueDestinations.size > 5) {
      patterns.push({
        patternType: 'fan_out',
        confidence: 70,
        riskContribution: 15,
        description: `Funds distributed to ${uniqueDestinations.size} different addresses`,
      });
    }

    // Fan-in detection
    const receivedTxs = txs.filter((tx) => tx.to === address);
    const uniqueSources = new Set(receivedTxs.map((tx) => tx.from));
    if (uniqueSources.size > 5) {
      patterns.push({
        patternType: 'fan_in',
        confidence: 65,
        riskContribution: 12,
        description: `Funds aggregated from ${uniqueSources.size} different addresses`,
      });
    }

    return patterns;
  }

  async getLatestAssessment(walletId: string): Promise<RiskAssessment | null> {
    return this.riskRepo.findOne({ where: { walletId }, order: { assessedAt: 'DESC' } });
  }
}
