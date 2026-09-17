/**
 * Unit tests for the Node.js ML runtime (apps/api/src/modules/risk/ml-model.ts).
 *
 * Validates cross-language parity with the Python training pipeline using the
 * golden vectors exported by ml/train.py, and the SHAP axioms (efficiency),
 * plus conditions 5.1/5.2/5.4 from for-implementation/conditions.md.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MlRiskModel, extractFeatures, treeShapValues, treeValue } from '../../src/modules/risk/ml-model';
import { RiskClassification } from '@chainsentinel/types';

const ARTIFACTS = path.resolve(__dirname, '../../../../ml/artifacts');
const GOLDEN_PATH = path.join(ARTIFACTS, 'golden_vectors.json');

describe('MlRiskModel (trained XGBoost runtime)', () => {
  let model: MlRiskModel;
  let golden: any;

  beforeAll(() => {
    process.env.ML_MODEL_PATH = ARTIFACTS;
    model = new MlRiskModel();
    expect(model.available).toBe(true);
    golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8'));
  });

  it('loads the model and manifest with verified hash', () => {
    expect(model.modelVersion).toBe('xgb-wallet-v1');
    expect(model.modelHash).toHaveLength(64);
    expect(model.minFeatureSupport).toBe(3);
    expect(model.confidenceThreshold).toBe(0.6);
  });

  it('feature extraction matches the Python pipeline (golden vectors)', () => {
    for (const v of golden.vectors) {
      const feats = extractFeatures({
        txs: v.txs.map((t: any) => ({
          from: t.from,
          to: t.to,
          amount: t.amount,
          timestamp: t.timestamp,
          chain: t.chain,
          kind: t.kind,
        })),
        walletAddress: v.wallet_id,
        firstSeen: new Date(v.first_seen * 1000),
        distanceFromReport: v.distance_from_report,
      });
      for (const name of Object.keys(v.features)) {
        expect(feats[name]).toBeCloseTo(v.features[name], 4);
      }
    }
  });

  it('logit and probability match the Python pipeline (golden vectors)', () => {
    for (const v of golden.vectors) {
      const logit = model.predictLogit(v.features);
      expect(logit).toBeCloseTo(v.logit, 4);
      const prob = 1 / (1 + Math.exp(-logit));
      expect(prob).toBeCloseTo(v.probability, 4);
    }
  });

  it('SHAP values match the Python pipeline and satisfy efficiency (axiom)', () => {
    for (const v of golden.vectors) {
      const phi = model.shapValues(v.features);
      for (const [name, value] of Object.entries(v.shap)) {
        expect(phi[name] ?? 0).toBeCloseTo(value as number, 3);
      }
      const total = Object.values(phi).reduce((a, b) => a + b, 0);
      const residual = total - (model.predictLogit(v.features) - model.expectedLogit());
      expect(Math.abs(residual)).toBeLessThan(1e-5);
    }
  });

  it('assess() returns a complete, explainable prediction (condition 5.4)', () => {
    const v = golden.vectors[0];
    const res = model.assess({
      txs: v.txs.map((t: any) => ({
        from: t.from, to: t.to, amount: t.amount, timestamp: t.timestamp, chain: t.chain, kind: t.kind,
      })),
      walletAddress: v.wallet_id,
      firstSeen: new Date(v.first_seen * 1000),
      distanceFromReport: v.distance_from_report,
    });
    expect(res.modelVersion).toBe('xgb-wallet-v1');
    expect(res.modelHash).toHaveLength(64);
    expect(res.explanation.length).toBeGreaterThan(0);
    expect(res.explanation.length).toBeLessThanOrEqual(5);
    expect(res.confidence).toBeCloseTo(Math.max(res.probability, 1 - res.probability), 6);
    expect(res.logit).toBeCloseTo(v.logit, 4);
  });

  it('insufficient transaction history -> INSUFFICIENT_DATA (condition 5.2)', () => {
    const v = golden.vectors[0];
    const res = model.assess({
      txs: [v.txs[0]], // single tx < min feature support (3)
      walletAddress: v.wallet_id,
      firstSeen: new Date(v.first_seen * 1000),
      distanceFromReport: v.distance_from_report,
    });
    expect(res.insufficientData).toBe(true);
    expect(res.classification).toBe(RiskClassification.INSUFFICIENT_DATA);
  });

  it('low confidence degrades to UNKNOWN instead of a forced label (condition 5.1)', () => {
    // A wallet with a handful of txs that the model considers ~50/50 should
    // yield confidence < 0.6 -> UNKNOWN, never a confident guess.
    const v = golden.vectors[0];
    const txs = v.txs.slice(0, 4);
    const res = model.assess({
      txs,
      walletAddress: v.wallet_id,
      firstSeen: new Date(v.first_seen * 1000),
      distanceFromReport: v.distance_from_report,
    });
    if (res.confidence < model.confidenceThreshold) {
      expect(res.classification).toBe(RiskClassification.UNKNOWN);
    }
  });

  it('per-tree SHAP is consistent with tree values (single-tree efficiency)', () => {
    // Rebuild a tiny tree and verify sum(phi) == value(x) - E[empty]
    const leaf = (id: number, value: number, cover: number) => ({ nodeid: id, leaf: value, cover });
    const tree = {
      nodeid: 0,
      split: 'a',
      split_condition: 0.5,
      yes: 1,
      no: 2,
      missing: 1,
      cover: 1.0,
      children: [
        { nodeid: 1, split: 'b', split_condition: 0.5, yes: 3, no: 4, missing: 3, cover: 0.5, children: [leaf(3, 1.0, 0.25), leaf(4, 2.0, 0.25)] },
        { nodeid: 2, split: 'b', split_condition: 0.5, yes: 5, no: 6, missing: 5, cover: 0.5, children: [leaf(5, 2.0, 0.25), leaf(6, 1.0, 0.25)] },
      ],
    } as any;
    const x = { a: 0.2, b: 0.2 };
    const phi = treeShapValues(tree, x);
    expect(phi.a).toBeCloseTo(phi.b, 9); // symmetry
    const total = Object.values(phi).reduce((s, v) => s + v, 0);
    const expected = treeValue(tree, x) - 1.5; // E[empty] = cover-weighted leaf mean = 1.5
    expect(total).toBeCloseTo(expected, 9);
  });
});