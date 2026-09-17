import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RiskAssessment } from '../../database/entities/risk-assessment.entity';
import { NormalizedTransaction } from '../../database/entities/normalized-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { RiskLevel, RiskClassification, NodeKind } from '@chainsentinel/types';
import { MlRiskModel } from './ml-model';

/** CONDITIONS 5.1/5.2 — thresholds are config values, encoded not ad-hoc */
export const RISK_CONFIDENCE_THRESHOLD = 0.6;
export const MIN_FEATURE_SUPPORT_TXS = 3;

/** Model version/hash is recorded on every assessment (RULES §5, CONDITION 5.4) */
export const RISK_MODEL_VERSION = 'rules-heuristic-v1';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    @InjectRepository(RiskAssessment) private riskRepo: Repository<RiskAssessment>,
    @InjectRepository(NormalizedTransaction) private txRepo: Repository<NormalizedTransaction>,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    private readonly mlModel: MlRiskModel,
  ) {}

  async assessWallet(walletId: string, walletAddress: string, chain: string): Promise<RiskAssessment> {
    // CONDITION 5.3 — infra nodes (miners/validators) never get wallet-behavior scoring
    const walletEntity = await this.walletRepo.findOne({ where: { id: walletId } });
    if (walletEntity?.nodeKind === NodeKind.INFRA) {
      return this.saveAssessment({
        walletId,
        rawScore: 0,
        classification: RiskClassification.UNKNOWN,
        confidence: 0,
        insufficientData: true,
        factors: [],
        explanation: [
          { feature: 'node_kind', contribution: 0, value: 'INFRA' },
        ],
        fraudPatterns: [],
        note: 'Infrastructure node (miner/validator/pool): wallet-behavior ML features are not applied (RULES §5, CONDITION 5.3).',
      });
    }

    const lower = walletAddress.toLowerCase();
    const txs = await this.txRepo.createQueryBuilder('t')
      .where('(LOWER(t.from) = :lower OR LOWER(t.to) = :lower) AND t.chain = :chain', { lower, chain })
      .getMany();


    // ML-first path (conditions 5.1-5.4): the trained XGBoost model with SHAP
    // explanations. Falls back to rules-heuristic-v1 on any error.
    if (this.mlModel.available) {
      try {
        return await this.assessWithMl(walletEntity!, txs, walletAddress);
      } catch (err: any) {
        this.logger.warn(`ML risk assessment failed, falling back to rules-heuristic-v1: ${err.message}`);
      }
    }

    // CONDITION 5.2 — insufficient transaction history: flag, degrade confidence, no forced label
    if (txs.length < MIN_FEATURE_SUPPORT_TXS) {
      return this.saveAssessment({
        walletId,
        rawScore: 0,
        classification: RiskClassification.INSUFFICIENT_DATA,
        confidence: Math.min(txs.length / MIN_FEATURE_SUPPORT_TXS, 0.59),
        insufficientData: true,
        factors: [],
        explanation: [
          { feature: 'transaction_count', contribution: 0, value: `${txs.length} (< ${MIN_FEATURE_SUPPORT_TXS} required)` },
        ],
        fraudPatterns: [],
        note: `Wallet has ${txs.length} transaction(s); below minimum feature support (${MIN_FEATURE_SUPPORT_TXS}). No risk classification is forced.`,
      });
    }

    const factors: Array<{ factor: string; score: number; weight: number; description: string }> = [];
    const explanation: Array<{ feature: string; contribution: number; value: string }> = [];
    let totalScore = 0;

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
      explanation.push({ feature: 'tx_velocity_24h', contribution: velocityScore / 25, value: `${recentTxs.length}` });
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
      explanation.push({ feature: 'rapid_forwarding', contribution: rapidScore / 20, value: `${rapidForwardCount}` });
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
      explanation.push({ feature: 'max_amount', contribution: amountScore / 15, value: `${maxAmount}` });
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
      explanation.push({ feature: 'chain_count', contribution: crossChainScore / 15, value: `${chains.size}` });
      totalScore += crossChainScore;
    }

    // Factor 5: Wallet age
    if (walletEntity?.firstSeen) {
      const ageDays = (Date.now() - new Date(walletEntity.firstSeen).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 7) {
        const ageScore = 15;
        factors.push({
          factor: 'New Wallet',
          score: ageScore,
          weight: 15,
          description: `Wallet created ${Math.floor(ageDays)} days ago`,
        });
        explanation.push({ feature: 'wallet_age_days', contribution: 1, value: `${Math.floor(ageDays)}` });
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
      explanation.push({ feature: 'unique_counterparties', contribution: 1, value: `${counterparties.size}` });
      totalScore += cpScore;
    }

    // Factor 7: Chainabuse Real Threat Intelligence
    try {
      const chainabuseToken = process.env.CHAINABUSE_API_KEY || 'ca_QlI1djRYTU14eEh6Y3J2M0w4cVczQzZ6LjUrTjVPNkFGcVdhelpiTXlZZ2dsT3c9PQ';
      const authHeader = 'Basic ' + Buffer.from(chainabuseToken + ':').toString('base64');
      const caController = new AbortController();
      const caTimeout = setTimeout(() => caController.abort(), 4000);
      const caRes = await fetch(`https://api.chainabuse.com/v0/reports?address=${walletAddress}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        signal: caController.signal,
      });
      clearTimeout(caTimeout);
      if (caRes.ok) {
        const caData: any = await caRes.json();
        const reportCount = caData.count || caData.reports?.length || 0;
        if (reportCount > 0) {
          const caScore = Math.min(reportCount * 15, 40);
          const topCategories = Array.from(new Set(caData.reports?.map((r: any) => r.scamCategory).filter(Boolean))).slice(0, 3).join(', ');
          factors.push({
            factor: 'Chainabuse Threat Reports',
            score: caScore,
            weight: 35,
            description: `Flagged in ${reportCount} community report(s) on Chainabuse (${topCategories || 'Scam/Fraud'})`,
          });
          explanation.push({ feature: 'chainabuse_reports', contribution: caScore / 40, value: `${reportCount}` });
          totalScore += caScore;
        }
      }
    } catch (caErr: any) {
      this.logger.debug(`Chainabuse intelligence check skipped: ${caErr.message}`);
    }

    totalScore = Math.min(totalScore, 100);

    // CONDITION 5.1 — low signal strength degrades confidence instead of forcing a label
    const confidence = this.computeConfidence(txs.length, counterparties.size, factors.length);

    let classification: RiskClassification;
    if (confidence < RISK_CONFIDENCE_THRESHOLD) {
      classification = RiskClassification.UNKNOWN;
    } else {
      classification =
        totalScore >= 60 ? RiskClassification.HIGH_RISK
        : totalScore >= 40 ? RiskClassification.MEDIUM_RISK
        : RiskClassification.LOW_RISK;
    }

    const riskLevel =
      totalScore >= 80 ? RiskLevel.CRITICAL
      : totalScore >= 60 ? RiskLevel.HIGH
      : totalScore >= 40 ? RiskLevel.MEDIUM
      : RiskLevel.LOW;

    const fraudPatterns = this.detectFraudPatterns(txs, walletAddress);

    return this.saveAssessment({
      walletId,
      rawScore: totalScore,
      classification,
      confidence,
      insufficientData: false,
      factors,
      explanation,
      fraudPatterns,
      riskLevel,
      updateWallet: true,
    });
  }

  /**
   * ML path: score the wallet with the trained XGBoost model + exact TreeSHAP
   * explanation (conditions 5.1/5.2/5.4). Every saved assessment records the
   * model version and SHA-256 hash used to produce it.
   */
  private async assessWithMl(
    walletEntity: Wallet,
    txs: NormalizedTransaction[],
    walletAddress: string,
  ): Promise<RiskAssessment> {
    const ml = this.mlModel.assess({
      txs: txs.map((tx) => ({
        from: tx.from,
        to: tx.to ?? '',
        amount: parseFloat(tx.amountNormalized) || 0,
        timestamp: new Date(tx.timestamp).getTime() / 1000,
        chain: tx.chain,
      })),
      walletAddress,
      firstSeen: walletEntity.firstSeen ?? undefined,
      distanceFromReport: 0,
    });

    const explanation = ml.explanation.map((e) => ({
      feature: e.feature,
      contribution: e.contribution,
      value: e.value,
    }));

    if (ml.insufficientData) {
      return this.saveAssessment({
        walletId: walletEntity.id,
        rawScore: 0,
        classification: RiskClassification.INSUFFICIENT_DATA,
        confidence: Math.min(ml.confidence, 0.59),
        insufficientData: true,
        factors: [],
        explanation,
        fraudPatterns: [],
        note: `ML: ${txs.length} transaction(s) below minimum feature support (${this.mlModel.minFeatureSupport}). No risk classification is forced (CONDITION 5.2).`,
        modelVersion: ml.modelVersion,
        modelHash: ml.modelHash,
      });
    }

    // Surface the top SHAP contributors as the factor breakdown (RULES §5) with plain-English investigator context
    const FEATURE_FRIENDLY_NAMES: Record<string, { title: string; desc: (v: string) => string }> = {
      median_holding_min: {
        title: 'Median Asset Holding Duration',
        desc: (v) => `Funds held for ~${Math.max(1, Math.round(Math.pow(10, parseFloat(v) || 0)))} mins before forwarding (indicates automated layering velocity).`,
      },
      avg_holding_min: {
        title: 'Average Fund Dwell Time',
        desc: (v) => `Average holding period between incoming & outgoing transfers is ${Math.max(1, Math.round(Math.pow(10, parseFloat(v) || 0)))} mins.`,
      },
      activity_frequency: {
        title: 'Transaction Frequency & Velocity',
        desc: (v) => `High frequency activity detected: approximately ${parseFloat(v).toFixed(1)} operations per active trading day.`,
      },
      tx_count: {
        title: 'Total Transaction History',
        desc: (v) => `${v} total indexed on-chain transactions on this ledger.`,
      },
      log_amount_received_total: {
        title: 'Cumulative Inflow Volume',
        desc: () => `Substantial total cryptocurrency volume received across verified counterparty channels.`,
      },
      log_amount_sent_total: {
        title: 'Cumulative Outflow Volume',
        desc: () => `Substantial total volume dispatched to external target addresses.`,
      },
      unique_senders: {
        title: 'Counterparty Diversity (Senders)',
        desc: (v) => `Incoming transfers received from ${v} distinct funding source(s).`,
      },
      unique_receivers: {
        title: 'Counterparty Diversity (Receivers)',
        desc: (v) => `Outgoing transfers distributed to ${v} distinct recipient address(es).`,
      },
      log_max_amount: {
        title: 'Peak Transaction Magnitude',
        desc: () => `Contains high-value single transfer transactions that trigger forensic exposure thresholds.`,
      },
      forwarding_ratio: {
        title: 'Fund Forwarding Ratio (Pass-Through)',
        desc: (v) => `Pass-through ratio of ${v}: funds forwarded relative to total receipts (classic transit/hop behavior).`,
      },
      velocity_24h: {
        title: '24-Hour Velocity Surge',
        desc: (v) => `${v} transactions executed within a compact 24-hour time window.`,
      },
      vasp_proximity: {
        title: 'VASP / Exchange Proximity',
        desc: (v) => `Distance to regulated exchange off-ramp or deposit desk is ${v} hop(s).`,
      },
      mixer_interaction: {
        title: 'Mixer / Privacy Protocol Exposure',
        desc: () => `Observed proximity or direct interactions with privacy/tumbler contracts.`,
      },
      bridge_interaction: {
        title: 'Cross-Chain Bridge Routing',
        desc: () => `Evidence of liquidity movement across blockchain bridges.`,
      },
      sanctioned_match: {
        title: 'Sanctioned Entity Proximity',
        desc: () => `Counterparty connection detected matching OFAC / global sanctions list.`,
      },
      distance_from_report: {
        title: 'Fraud Complaint Proximity',
        desc: (v) => `Hop distance from known victim-reported fraud complaint is ${v} hop(s).`,
      },
      rapid_forwarding_count: {
        title: 'Rapid Layering Forward Count',
        desc: (v) => `${v} occurrences of immediate fund dispatch following receipt.`,
      },
    };

    const shapTotal = Object.values(ml.shap).reduce((a, b) => a + Math.abs(b), 0);
    const factors = ml.explanation.map((e) => {
      const friendly = FEATURE_FRIENDLY_NAMES[e.feature];
      const factorTitle = friendly ? friendly.title : e.feature.replace(/_/g, ' ').toUpperCase();
      const factorDesc = friendly ? friendly.desc(e.value) : `SHAP feature contribution: ${e.value}`;
      return {
        factor: factorTitle,
        score: Math.min(100, Math.max(1, Math.round(Math.abs(e.contribution) * 100))),
        weight: shapTotal > 0 ? Math.round((Math.abs(e.contribution) / shapTotal) * 100) : 0,
        description: factorDesc,
      };
    });

    return this.saveAssessment({
      walletId: walletEntity.id,
      rawScore: ml.score,
      classification: ml.classification,
      confidence: ml.confidence,
      insufficientData: false,
      factors,
      explanation,
      fraudPatterns: [],
      riskLevel: ml.riskLevel,
      updateWallet: true,
      modelVersion: ml.modelVersion,
      modelHash: ml.modelHash,
      note: ml.driftFlagged ? 'Prediction-distribution drift flagged vs training baseline — review recommended.' : undefined,
    });
  }

  /**
   * CONDITION 5.1 — confidence below threshold => classification UNKNOWN, never a forced label.
   * CONDITION 5.4 — every assessment carries explanation + model version + model hash.
   */
  private computeConfidence(txCount: number, counterpartyCount: number, factorCount: number): number {
    const support = Math.min(txCount / 20, 1) * 0.4
      + Math.min(counterpartyCount / 10, 1) * 0.3
      + Math.min(factorCount / 4, 1) * 0.3;
    return Math.round(support * 100) / 100;
  }

  private async saveAssessment(input: {
    walletId: string;
    rawScore: number;
    classification: RiskClassification;
    confidence: number;
    insufficientData: boolean;
    factors: Array<{ factor: string; score: number; weight: number; description: string }>;
    explanation: Array<{ feature: string; contribution: number; value: string }>;
    fraudPatterns: Array<{ patternType: string; confidence: number; riskContribution: number; description: string }>;
    note?: string;
    riskLevel?: RiskLevel;
    updateWallet?: boolean;
    modelVersion?: string;
    modelHash?: string;
  }): Promise<RiskAssessment> {
    const version = input.modelVersion ?? RISK_MODEL_VERSION;
    const modelHash = input.modelHash ?? crypto.createHash('sha256').update(RISK_MODEL_VERSION).digest('hex');

    const assessment = this.riskRepo.create({
      walletId: input.walletId,
      riskScore: input.rawScore,
      riskLevel: input.riskLevel
        ?? (input.rawScore >= 60 ? RiskLevel.HIGH : input.rawScore >= 40 ? RiskLevel.MEDIUM : RiskLevel.LOW),
      classification: input.classification,
      confidence: input.confidence as any,
      explanation: [...input.explanation, ...(input.note ? [{ feature: '_note', contribution: 0, value: input.note }] : [])] as any,
      modelVersion: version,
      modelHash,
      insufficientData: input.insufficientData,
      factors: input.factors as any,
      fraudPatterns: input.fraudPatterns as any,
      assessedAt: new Date(),
    });

    const saved = await this.riskRepo.save(assessment);

    if (input.updateWallet) {
      await this.walletRepo.update(input.walletId, {
        riskScore: input.rawScore,
        riskLevel: input.riskLevel ?? RiskLevel.LOW,
      });
    }

    this.logger.log(
      `Risk assessed: wallet=${input.walletId} score=${input.rawScore} class=${input.classification} confidence=${input.confidence} model=${version}`,
    );
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
          new Date(tx.timestamp).getTime() - new Date(recv.timestamp).getTime() < 30 * 60 * 1000,
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
