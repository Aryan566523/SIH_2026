/**
 * Node.js runtime for the trained XGBoost wallet risk model.
 *
 * Loads the artifacts exported by `ml/train.py` (model.json + manifest.json),
 * verifies the model SHA-256 against the manifest, extracts the same 25
 * wallet-level features as the Python pipeline (ml/features.py), runs
 * inference by walking the exported trees, and computes EXACT TreeSHAP
 * explanations (mirror of ml/shaplib.py) using the training cover stats.
 *
 * Conditions implemented (for-implementation/conditions.md):
 *   5.1  confidence < threshold -> UNKNOWN (never a forced label)
 *   5.2  insufficient transaction history -> INSUFFICIENT_DATA
 *   5.4  every prediction ships with SHAP explanation + model version + hash
 *   drift: prediction distribution is compared against the training baseline
 *
 * If the artifacts are missing or the hash does not verify, `available` is
 * false and RiskService falls back to the rules-heuristic model.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { RiskClassification, RiskLevel } from '@chainsentinel/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MlTx {
  from: string;
  to: string;
  amount: number;
  timestamp: number; // epoch seconds
  chain?: string;
  kind?: string; // 'vasp' | 'mixer' | 'bridge' | 'sanctioned' | 'normal' (synthetic fixtures)
}

export interface MlEntityContext {
  vaspAddresses?: Set<string>;
  mixerAddresses?: Set<string>;
  bridgeAddresses?: Set<string>;
  sanctionedAddresses?: Set<string>;
}

export interface MlAssessInput {
  txs: MlTx[];
  walletAddress: string;
  firstSeen?: Date;
  distanceFromReport?: number;
  context?: MlEntityContext;
}

export interface MlExplanationItem {
  feature: string;
  contribution: number;
  value: string;
}

export interface MlAssessment {
  probability: number;
  logit: number;
  score: number; // 0-100
  classification: RiskClassification;
  riskLevel: RiskLevel;
  confidence: number;
  insufficientData: boolean;
  explanation: MlExplanationItem[];
  shap: Record<string, number>;
  modelVersion: string;
  modelHash: string;
  driftFlagged: boolean;
}

interface TreeNode {
  nodeid: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  cover?: number;
  leaf?: number;
  children?: TreeNode[];
}

interface TreeModel {
  tree_structure: TreeNode;
}

interface MlModelJson {
  learner: {
    learner_model_param: { base_score: string };
    gradient_booster: { model: { trees: TreeModel[] } };
  };
}

interface MlManifest {
  model_version: string;
  model_sha256: string;
  confidence_threshold: number;
  min_feature_support_txs: number;
  expected_prob_mean: number;
  feature_minmax: Record<string, [number, number]>;
  features: Array<{ name: string; group: string; desc: string }>;
}

// ---------------------------------------------------------------------------
// Feature extraction (mirror of ml/features.py)
// ---------------------------------------------------------------------------

const FEATURE_NAMES = [
  'tx_count', 'log_amount_received_total', 'log_amount_sent_total', 'unique_senders', 'unique_receivers',
  'log_max_amount', 'avg_holding_min', 'median_holding_min', 'forwarding_ratio', 'activity_frequency',
  'fan_in_ratio', 'fan_out_ratio', 'velocity_24h', 'vasp_proximity', 'mixer_interaction',
  'bridge_interaction', 'sanctioned_match', 'distance_from_report', 'rapid_forwarding_count',
  'fund_split_count', 'fund_merge_count', 'min_receive_send_gap_min', 'cross_chain_count',
  'wallet_age_days', 'amount_concentration',
];

function log10p1(x: number): number {
  return Math.log10(Math.max(x, 0) + 1);
}

function classify(addr: string, fallback: string, kind: string | undefined, ctx: MlEntityContext): string {
  if (kind) return kind;
  if (ctx.vaspAddresses?.has(addr)) return 'vasp';
  if (ctx.mixerAddresses?.has(addr)) return 'mixer';
  if (ctx.bridgeAddresses?.has(addr)) return 'bridge';
  if (ctx.sanctionedAddresses?.has(addr)) return 'sanctioned';
  return fallback;
}

export function extractFeatures(input: MlAssessInput): Record<string, number> {
  const ctx = input.context ?? {};
  const wallet = input.walletAddress;
  let nowTs = 0;
  for (const t of input.txs) nowTs = Math.max(nowTs, t.timestamp);

  const received: Array<{ amount: number; sender: string; ts: number }> = [];
  const sent: Array<{ amount: number; receiver: string; ts: number }> = [];
  const allTs: number[] = [];
  const counterparties = new Set<string>();
  const counterpartyKinds = new Map<string, string>();
  const chains = new Set<string>();
  let maxAmount = 0.0;
  let amountReceivedTotal = 0.0;
  let amountSentTotal = 0.0;

  for (const tx of input.txs) {
    const amount = Number.isFinite(tx.amount) ? tx.amount : 0;
    const ts = tx.timestamp;
    const chain = tx.chain ?? '';
    const frm = tx.from ?? '';
    const to = tx.to ?? '';
    allTs.push(ts);
    if (chain) chains.add(chain);

    if (frm === wallet) {
      sent.push({ amount, receiver: to, ts });
      if (to) {
        counterparties.add(to);
        counterpartyKinds.set(to, classify(to, 'normal', tx.kind, ctx));
      }
      amountSentTotal += amount;
    } else if (to === wallet) {
      received.push({ amount, sender: frm, ts });
      if (frm) {
        counterparties.add(frm);
        counterpartyKinds.set(frm, classify(frm, 'normal', tx.kind, ctx));
      }
      amountReceivedTotal += amount;
    }
    maxAmount = Math.max(maxAmount, amount);
  }

  const txCount = input.txs.length;
  const uniqueSenders = new Set(received.map((r) => r.sender)).size;
  const uniqueReceivers = new Set(sent.map((s) => s.receiver)).size;

  // holding times: for each received tx, first send after it
  const holding: number[] = [];
  const minGaps: number[] = [];
  let rapid = 0;
  for (const recv of received) {
    for (const s of sent) {
      if (s.ts > recv.ts) {
        const gapMin = (s.ts - recv.ts) / 60.0;
        holding.push(gapMin);
        minGaps.push(gapMin);
        if (gapMin <= 30.0) rapid += 1;
        break;
      }
    }
  }
  holding.sort((a, b) => a - b);
  const avgHolding = holding.length ? holding.reduce((a, b) => a + b, 0) / holding.length : 0;
  const medianHolding = holding.length ? holding[Math.floor(holding.length / 2)] : 0;

  // fan-in / fan-out events (3+ unique counterparties within 10 min)
  const fanEvents = (rows: Array<{ ts: number; addr: string }>, windowMin: number): number => {
    const sorted = [...rows].sort((a, b) => a.ts - b.ts);
    let events = 0;
    for (let i = 0; i < sorted.length; i++) {
      const window = sorted.filter((r) => r.ts >= sorted[i].ts && (r.ts - sorted[i].ts) / 60.0 <= windowMin);
      if (new Set(window.map((r) => r.addr)).size >= 3) events += 1;
    }
    return events;
  };
  const splitCount = fanEvents(sent.map((s) => ({ ts: s.ts, addr: s.receiver })), 10.0);
  const mergeCount = fanEvents(received.map((r) => ({ ts: r.ts, addr: r.sender })), 10.0);

  // velocity: max tx count in any 24h window
  let velocity = 0.0;
  if (allTs.length) {
    const sortedTs = [...allTs].sort((a, b) => a - b);
    let j = 0;
    for (let i = 0; i < sortedTs.length; i++) {
      while (sortedTs[i] - sortedTs[j] > 86400) j += 1;
      velocity = Math.max(velocity, i - j + 1);
    }
    velocity = velocity / txCount;
  }

  const kinds = Array.from(counterpartyKinds.values());
  const anyVasp = kinds.includes('vasp') || [...counterparties].some((c) => ctx.vaspAddresses?.has(c));
  const anyMixer = kinds.includes('mixer') || [...counterparties].some((c) => ctx.mixerAddresses?.has(c));
  const anyBridge = kinds.includes('bridge') || [...counterparties].some((c) => ctx.bridgeAddresses?.has(c));
  const sanctioned = kinds.includes('sanctioned') || [...counterparties].some((c) => ctx.sanctionedAddresses?.has(c));

  let spanDays = 1.0;
  if (allTs.length >= 2) spanDays = Math.max((Math.max(...allTs) - Math.min(...allTs)) / 86400.0, 1.0);

  let ageDays = 1.0;
  if (input.firstSeen) ageDays = Math.max((nowTs - input.firstSeen.getTime() / 1000) / 86400.0, 1.0);

  const amounts = received.map((r) => r.amount).concat(sent.map((s) => s.amount)).sort((a, b) => a - b);
  const medianAmount = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;

  const minGap = minGaps.length ? Math.min(...minGaps) : 0.0;

  return {
    tx_count: txCount,
    log_amount_received_total: log10p1(amountReceivedTotal),
    log_amount_sent_total: log10p1(amountSentTotal),
    unique_senders: uniqueSenders,
    unique_receivers: uniqueReceivers,
    log_max_amount: log10p1(maxAmount),
    avg_holding_min: log10p1(avgHolding),
    median_holding_min: log10p1(medianHolding),
    forwarding_ratio: Math.min(amountReceivedTotal > 0 ? amountSentTotal / amountReceivedTotal : 0, 100),
    activity_frequency: txCount / spanDays,
    fan_in_ratio: received.length ? uniqueSenders / received.length : 0,
    fan_out_ratio: sent.length ? uniqueReceivers / sent.length : 0,
    velocity_24h: velocity,
    vasp_proximity: anyVasp ? 1.0 : 3.0,
    mixer_interaction: anyMixer ? 1.0 : 0.0,
    bridge_interaction: anyBridge ? 1.0 : 0.0,
    sanctioned_match: sanctioned ? 1.0 : 0.0,
    distance_from_report: input.distanceFromReport ?? 0.0,
    rapid_forwarding_count: rapid,
    fund_split_count: splitCount,
    fund_merge_count: mergeCount,
    min_receive_send_gap_min: log10p1(minGap),
    cross_chain_count: Math.max(chains.size - 1, 0),
    wallet_age_days: log10p1(ageDays),
    amount_concentration: maxAmount / (medianAmount + 1.0),
  };
}

// ---------------------------------------------------------------------------
// Tree walking + exact TreeSHAP (mirror of ml/shaplib.py)
// ---------------------------------------------------------------------------

function childrenIndex(node: TreeNode): Map<number, TreeNode> {
  const m = new Map<number, TreeNode>();
  for (const c of node.children ?? []) m.set(c.nodeid, c);
  return m;
}

export function treeValue(node: TreeNode, x: Record<string, number>): number {
  let n = node;
  while (n.leaf === undefined) {
    const kids = childrenIndex(n);
    const xv = x[n.split!] ?? 0;
    n = xv < n.split_condition! ? kids.get(n.yes!)! : kids.get(n.no!)!;
  }
  return n.leaf!;
}

export function treeExpectedValue(node: TreeNode, fixed: Set<string>, x: Record<string, number>): number {
  if (node.leaf !== undefined) return node.leaf!;
  const kids = childrenIndex(node);
  if (fixed.has(node.split!)) {
    const xv = x[node.split!] ?? 0;
    const child = xv < node.split_condition! ? kids.get(node.yes!)! : kids.get(node.no!)!;
    return treeExpectedValue(child, fixed, x);
  }
  const parentCover = node.cover ?? 1.0;
  const left = kids.get(node.yes!)!;
  const right = kids.get(node.no!)!;
  const wl = (left.cover ?? parentCover) / parentCover;
  const wr = (right.cover ?? parentCover) / parentCover;
  return wl * treeExpectedValue(left, fixed, x) + wr * treeExpectedValue(right, fixed, x);
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const out: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      out.push([arr[i], ...rest]);
    }
  }
  return out;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function treeShapValues(node: TreeNode, x: Record<string, number>): Record<string, number> {
  // path features (root -> leaf)
  const path: string[] = [];
  let n = node;
  while (n.leaf === undefined) {
    const feat = n.split!;
    path.push(feat);
    const kids = childrenIndex(n);
    const xv = x[feat] ?? 0;
    n = xv < n.split_condition! ? kids.get(n.yes!)! : kids.get(n.no!)!;
  }
  const uniq: string[] = [];
  for (const f of path) if (!uniq.includes(f)) uniq.push(f);
  const p = uniq.length;
  const phi: Record<string, number> = {};
  for (const f of uniq) phi[f] = 0;

  for (const f of uniq) {
    const others = uniq.filter((g) => g !== f);
    for (let k = 0; k <= others.length; k++) {
      const weight = (factorial(k) * factorial(p - k - 1)) / factorial(p);
      for (const sTuple of combinations(others, k)) {
        const s = new Set(sTuple);
        const sPlusF = new Set(sTuple);
        sPlusF.add(f);
        const e1 = treeExpectedValue(node, sPlusF, x);
        const e0 = treeExpectedValue(node, s, x);
        phi[f] += weight * (e1 - e0);
      }
    }
  }
  return phi;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

// ---------------------------------------------------------------------------
// Model service
// ---------------------------------------------------------------------------

const DRIFT_WINDOW = 200;
const DRIFT_THRESHOLD = 0.15;

@Injectable()
export class MlRiskModel {
  private readonly logger = new Logger('MlRiskModel');
  private model: MlModelJson | null = null;
  private manifest: MlManifest | null = null;
  private probWindow: number[] = [];
  available = false;

  constructor() {
    this.tryLoad();
  }

  private tryLoad(): void {
    const candidates: string[] = [
      process.env.ML_MODEL_PATH,
      path.resolve(__dirname, '../../../../../ml/artifacts'),
      path.resolve(process.cwd(), '../ml/artifacts'),
    ].filter((p) => !!p) as string[];

    for (const dir of candidates) {
      const modelPath = path.join(dir, 'model.json');
      const manifestPath = path.join(dir, 'manifest.json');
      if (!fs.existsSync(modelPath) || !fs.existsSync(manifestPath)) continue;
      try {
        const modelBytes = fs.readFileSync(modelPath);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as MlManifest;
        const digest = crypto.createHash('sha256').update(modelBytes).digest('hex');
        if (digest !== manifest.model_sha256) {
          this.logger.error(
            `ML model hash mismatch at ${dir}: file=${digest.slice(0, 16)} manifest=${manifest.model_sha256.slice(0, 16)}. Refusing to load (integrity check).`,
          );
          continue;
        }
        this.model = JSON.parse(modelBytes.toString('utf-8')) as MlModelJson;
        this.manifest = manifest;
        this.available = true;
        this.logger.log(
          `ML model loaded: ${manifest.model_version} (${manifest.features.length} features, sha256 ${digest.slice(0, 16)}…)`,
        );
        return;
      } catch (err: any) {
        this.logger.warn(`ML model load failed at ${dir}: ${err.message}`);
      }
    }
    this.logger.warn('ML model artifacts not found or invalid — risk scoring falls back to rules-heuristic-v1.');
  }

  get minFeatureSupport(): number {
    return this.manifest?.min_feature_support_txs ?? 3;
  }

  get confidenceThreshold(): number {
    return this.manifest?.confidence_threshold ?? 0.6;
  }

  get modelVersion(): string {
    return this.manifest?.model_version ?? 'rules-heuristic-v1';
  }

  get modelHash(): string {
    return this.manifest?.model_sha256 ?? '';
  }

  /** Expected model margin over the training distribution (SHAP efficiency baseline). */
  expectedLogit(): number {
    if (!this.model) throw new Error('ML model not loaded');
    const base = parseFloat(this.model.learner.learner_model_param.base_score);
    let logit = base > 0 && base < 1 ? Math.log(base / (1 - base)) : base;
    for (const tree of this.model.learner.gradient_booster.model.trees) {
      logit += treeExpectedValue(tree.tree_structure, new Set(), {});
    }
    return logit;
  }

  predictLogit(features: Record<string, number>): number {
    if (!this.model) throw new Error('ML model not loaded');
    const base = parseFloat(this.model.learner.learner_model_param.base_score);
    let logit = base > 0 && base < 1 ? Math.log(base / (1 - base)) : base;
    for (const tree of this.model.learner.gradient_booster.model.trees) {
      logit += treeValue(tree.tree_structure, features);
    }
    return logit;
  }

  shapValues(features: Record<string, number>): Record<string, number> {
    if (!this.model) throw new Error('ML model not loaded');
    const phi: Record<string, number> = {};
    for (const tree of this.model.learner.gradient_booster.model.trees) {
      for (const [f, v] of Object.entries(treeShapValues(tree.tree_structure, features))) {
        phi[f] = (phi[f] ?? 0) + v;
      }
    }
    return phi;
  }

  /** CONDITION 5.4 — every prediction carries explanation + model version + hash. */
  assess(input: MlAssessInput): MlAssessment {
    if (!this.model || !this.manifest) throw new Error('ML model not loaded');

    // Tree models handle out-of-range inputs natively (splits are thresholds),
    // so no feature clipping is applied — this keeps predictions identical to
    // the Python pipeline (golden-vector parity).
    const features = extractFeatures(input);
    const logit = this.predictLogit(features);
    const probability = sigmoid(logit);
    const shap = this.shapValues(features);
    const confidence = Math.max(probability, 1 - probability);
    const score = Math.round(probability * 100);
    const insufficientData = input.txs.length < this.manifest.min_feature_support_txs;

    // CONDITION 5.1 / 5.2 — unknown/insufficient instead of a forced label
    let classification: RiskClassification;
    if (insufficientData) {
      classification = RiskClassification.INSUFFICIENT_DATA;
    } else if (confidence < this.manifest.confidence_threshold) {
      classification = RiskClassification.UNKNOWN;
    } else {
      classification =
        score >= 60 ? RiskClassification.HIGH_RISK
        : score >= 40 ? RiskClassification.MEDIUM_RISK
        : RiskClassification.LOW_RISK;
    }

    const riskLevel =
      score >= 80 ? RiskLevel.CRITICAL
      : score >= 60 ? RiskLevel.HIGH
      : score >= 40 ? RiskLevel.MEDIUM
      : RiskLevel.LOW;

    const ranked = Object.entries(shap).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const explanation = ranked.slice(0, 5).map(([feature, contribution]) => ({
      feature,
      contribution: Math.round(contribution * 1e6) / 1e6,
      value: String(Math.round(features[feature] * 1000) / 1000),
    }));

    const driftFlagged = this.recordProbability(probability);

    return {
      probability,
      logit,
      score,
      classification,
      riskLevel,
      confidence,
      insufficientData,
      explanation,
      shap,
      modelVersion: this.manifest.model_version,
      modelHash: this.manifest.model_sha256,
      driftFlagged,
    };
  }

  /** Drift check: rolling mean of predictions vs training baseline. */
  private recordProbability(probability: number): boolean {
    this.probWindow.push(probability);
    if (this.probWindow.length > DRIFT_WINDOW) this.probWindow.shift();
    if (this.probWindow.length < 25 || !this.manifest) return false;
    const mean = this.probWindow.reduce((a, b) => a + b, 0) / this.probWindow.length;
    const shift = Math.abs(mean - this.manifest.expected_prob_mean);
    if (shift > DRIFT_THRESHOLD) {
      this.logger.warn(
        `ML prediction drift: window mean ${mean.toFixed(3)} vs training baseline ${this.manifest.expected_prob_mean.toFixed(3)} (threshold ${DRIFT_THRESHOLD}). Review/retraining recommended.`,
      );
      return true;
    }
    return false;
  }
}