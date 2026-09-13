import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, applyMigrations, type Db } from '../src/db/index.js';
import {
  createProduceRecord,
  listProduceRecords,
  getProduceById,
  updateProduceStatus,
  getCoffeeProduceSummary,
} from '../src/services/coffee.js';
import { members, users } from '../src/db/schema.js';

describe('Coffee Produce Service', () => {
  let db: Db;
  let memberId: number;
  let adminUserId: number;

  beforeEach(async () => {
    const handle = createDatabase(':memory:');
    db = handle.db;
    await applyMigrations(db);

    const [u] = await db
      .insert(users)
      .values({
        email: 'admin@thumari.local',
        name: 'Admin',
        passwordHash: 'hash',
        role: 'admin',
      })
      .returning();
    adminUserId = u!.id;

    const [m] = await db
      .insert(members)
      .values({
        memberNo: 'M-0001',
        firstName: 'Sarah',
        lastName: 'Cherono',
        phone: '+254 712 345 678',
      })
      .returning();
    memberId = m!.id;
  });

  it('creates and lists coffee produce delivery records', async () => {
    const produce = await createProduceRecord(db, {
      memberId,
      factoryGrowerNo: '1402',
      extractedMemberName: 'SARAH CHERONO',
      receiptNo: 'REC-1001',
      receiptDate: new Date('2026-09-12'),
      factoryName: 'Kii Factory',
      societyName: "Rung'eto FCS",
      grossKg: 105.0,
      tareKg: 5.0,
      netKg: 100.0,
      ratePerKgCents: 11000,
      grossAmountCents: 1100000,
      deductionsCents: 50000,
      netPayoutCents: 1050000,
      receiptImagePath: '/static/uploads/receipts/rec1.jpg',
      ocrRawText: 'Sample raw OCR text',
      status: 'pending_verification',
      recordedBy: adminUserId,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      notes: 'Cherry 1',
    });

    expect(produce.id).toBeGreaterThan(0);
    expect(produce.netKg).toBe(100.0);

    const list = await listProduceRecords(db, { memberId });
    expect(list.length).toBe(1);
    expect(list[0]?.produce.receiptNo).toBe('REC-1001');
    expect(list[0]?.member.firstName).toBe('Sarah');
  });

  it('updates verification status with verifier details', async () => {
    const produce = await createProduceRecord(db, {
      memberId,
      receiptNo: 'REC-1002',
      receiptDate: new Date(),
      grossKg: 50.0,
      tareKg: 0,
      netKg: 50.0,
      receiptImagePath: '/static/uploads/receipts/rec2.jpg',
      status: 'pending_verification',
      recordedBy: adminUserId,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      notes: null,
      ratePerKgCents: 0,
      grossAmountCents: 0,
      deductionsCents: 0,
      netPayoutCents: 0,
      ocrRawText: null,
      factoryGrowerNo: null,
      extractedMemberName: null,
      factoryName: null,
      societyName: null,
    });

    const updated = await updateProduceStatus(db, produce.id, adminUserId, 'verified', 'Approved from society ledger');
    expect(updated?.status).toBe('verified');
    expect(updated?.verifiedByUserId).toBe(adminUserId);

    const summary = await getCoffeeProduceSummary(db);
    expect(summary.totalDeliveries).toBe(1);
    expect(summary.verifiedDeliveries).toBe(1);
    expect(summary.totalNetKg).toBe(50.0);
  });
});
