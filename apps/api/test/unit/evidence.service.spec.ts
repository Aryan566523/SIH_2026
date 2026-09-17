/** Unit tests for the Evidence Engine (RULES §6 / CONDITIONS 6.1-6.5) */
import { EvidenceService } from '../../src/modules/evidence/evidence.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { ConfigService } from '@nestjs/config';

// TypeORM repository mock — in-memory rows, no DB required
class MockRepo {
  rows: any[] = [];
  private seq = 0;
  create(data: any) { return { id: undefined, ...data }; }
  async save(row: any) {
    if (!row.id) row.id = `ev-${++this.seq}`;
    this.rows.push(row);
    return row;
  }
  findOne({ where }: any) {
    return this.rows.find((r) =>
      (!where.sha256Hash || r.sha256Hash === where.sha256Hash) &&
      (where.investigationId === undefined || r.investigationId === where.investigationId) &&
      (!where.kind || r.kind === where.kind) &&
      (!where.id || r.id === where.id),
    ) || null;
  }
  async update(id: string, patch: any) {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
  }
  async find({ where }: any) {
    return this.rows.filter((r) => !where?.investigationId || r.investigationId === where.investigationId);
  }
}

describe('EvidenceService (RULES §6)', () => {
  let service: EvidenceService;
  let repo: MockRepo;
  const auditLog: any[] = [];

  beforeEach(() => {
    repo = new MockRepo();
    auditLog.length = 0;
    const audit = { log: jest.fn(async (d: any) => { auditLog.push(d); }) } as unknown as AuditService;
    const config = { get: jest.fn(() => 'test-signing-key') } as unknown as ConfigService;
    service = new EvidenceService(repo as any, audit, config);
  });

  it('canonicalize is deterministic regardless of key order (CONDITION 6.1)', () => {
    const a = service.canonicalize({ b: 2, a: { d: 4, c: [3, 1, 2] } });
    const b = service.canonicalize({ a: { c: [3, 1, 2], d: 4 }, b: 2 });
    expect(a).toBe(b);
  });

  it('creates hash + signature and the signature verifies (CONDITION 6.1)', async () => {
    const rec = await service.create({
      kind: 'transaction',
      payload: { txHash: '0xabc', blockNumber: 1, from: '0xf', to: '0xt', amount: '5', timestamp: '2026-01-01T00:00:00Z', status: 'confirmed', source: 'test' },
    });
    expect(rec.sha256Hash).toHaveLength(64);
    expect(service.verifySignature(rec.sha256Hash, rec.signature)).toBe(true);
    expect(auditLog.some((e) => e.action === 'EVIDENCE_CREATED')).toBe(true);
  });

  it('rejects evidence missing required fields (CONDITION 6.5)', async () => {
    await expect(service.create({
      kind: 'transaction',
      payload: { txHash: '0xabc' }, // missing blockNumber, from, to, amount...
    })).rejects.toThrow(/missing required field/i);
    expect(repo.rows).toHaveLength(0);
  });

  it('correction creates a new version, keeps and links the original — never overwrites (CONDITION 6.2)', async () => {
    const original = await service.create({
      kind: 'attribution',
      payload: { vaspName: 'ExchangeX', address: '0xaa', attributionState: 'Confirmed', confidence: 0.9, registryVersion: 'v1' },
    });
    const corrected = await service.createCorrection(original.id, { confidence: 0.75 }, 'confidence recalibrated');

    expect(corrected.version).toBe(2);
    expect(corrected.previousVersionId).toBe(original.id);
    // original retained, marked superseded, still present
    const stillThere = repo.rows.find((r) => r.id === original.id);
    expect(stillThere).toBeDefined();
    expect(stillThere.status).toBe('superseded');
    expect(stillThere.supersededBy).toBe(corrected.id);
  });

  it('flags tamper_suspected when canonical payload no longer matches stored hash (CONDITION 6.3)', async () => {
    const rec = await service.create({
      kind: 'report',
      payload: { caseId: 'case-1', sha256Hash: 'a'.repeat(64) },
    });
    // Simulate storage tampering: mutate the canonical form after creation
    rec.canonicalForm = service.canonicalize({ caseId: 'case-1', sha256Hash: 'a'.repeat(64), tampered: true });
    const outcome = await service.verify(rec.id);
    expect(outcome.valid).toBe(false);
    expect(outcome.status).toBe('tamper_suspected');
    expect(auditLog.some((e) => e.action === 'EVIDENCE_TAMPER_DETECTED')).toBe(true);
  });

  it('verifyPackage flags a package containing any tampered record', async () => {
    const r1 = await service.create({ kind: 'report', payload: { caseId: 'c1', sha256Hash: 'b'.repeat(64) } });
    await service.create({ kind: 'report', payload: { caseId: 'c1', sha256Hash: 'c'.repeat(64) }, investigationId: 'inv-1' });
    r1.investigationId = 'inv-1';

    // Tamper second record
    const r2 = repo.rows[repo.rows.length - 1];
    r2.canonicalForm = r2.canonicalForm + 'x';

    const outcome = await service.verifyPackage('inv-1');
    expect(outcome.allValid).toBe(false);
    expect(outcome.results.find((r) => r.evidenceId === r2.id)?.status).toBe('tamper_suspected');
  });
});
