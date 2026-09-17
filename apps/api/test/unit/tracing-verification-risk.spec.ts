/** Unit tests for bounded tracing + verification + risk UNKNOWN handling (RULES §3/§5, CONDITIONS 1.x/3.x/5.x) */
import { BoundedTracerService } from '../../src/modules/tracing/bounded-tracer.service';
import { VerificationService } from '../../src/modules/verification/verification.service';
import { VerificationStatus, TraceStopReason } from '@chainsentinel/types';

// ---------- Bounded tracer ----------

function makeTracerRepo(txsByAddress: Record<string, any[]>) {
  return {
    find: async ({ where }: any) => txsByAddress[where.from] || [],
  };
}

function makeWalletRepo(wallets: Record<string, any>) {
  return {
    findOne: async ({ where }: any) => wallets[where.address] || null,
  };
}

function makeVaspRepo() {
  return { createQueryBuilder: () => { throw new Error('not used in test'); } };
}

function makeTracer(txsByAddress: Record<string, any[]>, wallets: Record<string, any> = {}) {
  return new BoundedTracerService(
    makeTracerRepo(txsByAddress) as any,
    makeWalletRepo(wallets) as any,
    makeVaspRepo() as any,
  );
}

function tx(from: string, to: string, amount: string, hoursAgo = 1) {
  return {
    txHash: `0x${from.slice(2, 6)}${to.slice(2, 6)}${Math.random().toString(16).slice(2, 10)}`,
    from,
    to,
    amountNormalized: amount,
    asset: 'USDT',
    chain: 'ETHEREUM',
    timestamp: new Date(Date.now() - hoursAgo * 3600_000),
    fiatValueAtTime: null,
    blockNumber: 1000,
  };
}

describe('BoundedTracerService (RULES §3 / CONDITIONS 3.x)', () => {
  const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const C = '0xcccccccccccccccccccccccccccccccccccccccc';
  const D = '0xdddddddddddddddddddddddddddddddddddddddd';

  it('expands along the highest-priority edges within depth limit', async () => {
    const tracer = makeTracer({
      [A]: [tx(A, B, '10'), tx(A, C, '2')],
      [B]: [tx(B, C, '10')],
    });
    const result = await tracer.trace(A, { maxDepth: 3, maxNodes: 100, minAmount: 0.0001, maxRuntimeMs: 2000 });
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain(A);
    expect(ids).toContain(B);
    expect(ids).toContain(C);
    // Repeated forwarding (A→B→C same amount) should have been expanded, not pruned by amount
    expect(result.prunedCount).toBe(0);
  });

  it('prunes branches below the minimum amount threshold (CONDITION 3.5)', async () => {
    const tracer = makeTracer({ [A]: [tx(A, B, '10'), tx(A, C, '0.0001')] });
    const result = await tracer.trace(A, { maxDepth: 3, maxNodes: 100, minAmount: 1, maxRuntimeMs: 2000 });
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain(B);
    expect(ids).not.toContain(C);
    expect(result.prunedCount).toBeGreaterThan(0);
  });

  it('never re-expands a visited node (CONDITION 3.7)', async () => {
    // A -> B, B -> C, C -> A (cycle back to A)
    const tracer = makeTracer({
      [A]: [tx(A, B, '5')],
      [B]: [tx(B, C, '5')],
      [C]: [tx(C, A, '5')],
    });
    const result = await tracer.trace(A, { maxDepth: 10, maxNodes: 100, minAmount: 0.0001, maxRuntimeMs: 2000 });
    // A must appear exactly once even though C sends back to it
    expect(result.nodes.filter((n) => n.id === A)).toHaveLength(1);
  });

  it('stops at a mixer boundary and does not expand beyond it (CONDITION 3.2)', async () => {
    const mixer = '0xm mixer'.replace(' ', '');
    const wallets = {
      [mixer]: { address: mixer, nodeKind: 'SERVICE', entityLabel: 'MIXER', riskLevel: 'CRITICAL', riskScore: 99 },
    };
    const tracer = makeTracer({
      [A]: [tx(A, mixer, '7')],
      [mixer]: [tx(mixer, D, '7')], // must never be expanded
    }, wallets);
    const result = await tracer.trace(A, { maxDepth: 5, maxNodes: 100, minAmount: 0.0001, maxRuntimeMs: 2000 });

    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain(mixer);
    expect(ids).not.toContain(D);
    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0].reason).toBe(TraceStopReason.MIXER_BOUNDARY);
    expect(result.boundaries[0].confidenceReduction).toBeGreaterThan(0);
  });

  it('marks result incomplete instead of failing when node budget is tiny (CONDITION 3.8)', async () => {
    const tracer = makeTracer({
      [A]: [tx(A, B, '5'), tx(A, C, '5'), tx(A, D, '5')],
    });
    const result = await tracer.trace(A, { maxDepth: 5, maxNodes: 2, minAmount: 0.0001, maxRuntimeMs: 2000 });
    expect(result.incomplete).toBe(true);
    expect(result.incompleteReason).toBe(TraceStopReason.MAX_NODES);
    expect(result.nodes.length).toBeGreaterThanOrEqual(2); // partial results still returned
  });
});

// ---------- Verification service ----------

function makeVerificationService() {
  const updated: any[] = [];
  const txRepo = { update: async (id: string, patch: any) => updated.push({ id, patch }) };
  const sourceRepo = { find: async () => [] };
  const config = { get: jest.fn(() => null) } as unknown as any;
  const svc = new VerificationService(txRepo as any, sourceRepo as any, config);
  return { svc, updated };
}

describe('VerificationService (RULES §0.2 / CONDITIONS 1.1-1.5)', () => {
  it('marks VERIFIED when the independent source agrees (CONDITION 1.2)', async () => {
    const { svc } = makeVerificationService();
    const result = await svc.crossCheckTransaction(
      '0xtx',
      { name: 'own_node', kind: 'own_node', data: { from: '0xa', to: '0xb', amount: '5', blockNumber: 100 } },
      [{ name: 'public_rpc', kind: 'independent_rpc', data: { from: '0xa', to: '0xb', amount: '5', blockNumber: 100 } }],
    );
    expect(result.status).toBe(VerificationStatus.VERIFIED);
  });

  it('marks UNVERIFIED when only one source exists (CONDITION 1.1)', async () => {
    const { svc } = makeVerificationService();
    const result = await svc.crossCheckTransaction(
      '0xtx',
      { name: 'own_node', kind: 'own_node', data: { from: '0xa' } },
      [{ name: 'public_rpc', kind: 'independent_rpc', data: null }], // unreachable
    );
    expect(result.status).toBe(VerificationStatus.UNVERIFIED);
  });

  it('marks CONFLICT on disagreement and never auto-resolves (CONDITION 1.3)', async () => {
    const { svc } = makeVerificationService();
    const result = await svc.crossCheckTransaction(
      '0xtx',
      { name: 'own_node', kind: 'own_node', data: { from: '0xa', to: '0xb', amount: '5' } },
      [{ name: 'public_rpc', kind: 'independent_rpc', data: { from: '0xa', to: '0xb', amount: '9' } }],
    );
    expect(result.status).toBe(VerificationStatus.CONFLICT);
    expect(result.detail).toBeUndefined(); // no auto-resolution — manual reconciliation required
  });

  it('persists the verification outcome on the transaction (CONDITIONS 1.1-1.3 storage)', async () => {
    const { svc, updated } = makeVerificationService();
    const result = await svc.crossCheckTransaction(
      '0xtx',
      { name: 'own_node', kind: 'own_node', data: { from: '0xa' } },
      [{ name: 'public_rpc', kind: 'independent_rpc', data: { from: '0xa' } }],
    );
    await svc.applyVerification('tx-row-1', result, { dataSource: 'test', collectedAt: new Date(), syncState: 'SYNCED' });
    expect(updated[0].id).toBe('tx-row-1');
    expect(updated[0].patch.verificationStatus).toBe(VerificationStatus.VERIFIED);
    expect(updated[0].patch.dataSource).toBe('test');
  });

  it('reorg revalidation downgrades affected transactions from verified (CONDITION 1.5)', async () => {
    const rows = [
      { id: 't1', chain: 'ETHEREUM', blockNumber: 100 },
      { id: 't2', chain: 'ETHEREUM', blockNumber: 100 },
    ];
    const updated: any[] = [];
    const txRepo = {
      createQueryBuilder: () => ({
        where: () => ({
          andWhere: () => ({
            getMany: async () => rows,
          }),
        }),
      }),
      update: async (id: string, patch: any) => updated.push({ id, patch }),
    };
    const svc = new VerificationService(txRepo as any, { find: async () => [] } as any, {} as any);
    const outcome = await svc.revalidateBlocks([100], 'ETHEREUM');
    expect(outcome.revalidated).toBe(2);
    expect(updated.every((u) => u.patch.verificationStatus === VerificationStatus.UNVERIFIED)).toBe(true);
    expect(updated.every((u) => u.patch.syncState === 'REVALIDATED_AFTER_REORG')).toBe(true);
  });
});
