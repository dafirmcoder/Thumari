import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, applyMigrations, type Db } from '../src/db/index.js';
import {
  getMonthlyContributionsSummary,
  getAnnualContributionsSummary,
} from '../src/services/reports.js';
import { members, contributionTypes, contributions, users } from '../src/db/schema.js';

describe('Contributions Summary Reports', () => {
  let db: Db;

  beforeEach(async () => {
    const handle = createDatabase(':memory:');
    db = handle.db;
    await applyMigrations(db);

    const [u] = await db.insert(users).values({
      email: 'admin@thumari.local',
      name: 'Admin',
      passwordHash: 'hash',
      role: 'admin',
    }).returning();

    const [t1] = await db.insert(contributionTypes).values({
      name: 'Monthly Savings',
      kind: 'savings',
      defaultAmountCents: 200000,
    }).returning();

    const [t2] = await db.insert(contributionTypes).values({
      name: 'Welfare Fund',
      kind: 'welfare',
      defaultAmountCents: 50000,
    }).returning();

    const [m1] = await db.insert(members).values({
      memberNo: 'M-0001',
      firstName: 'John',
      lastName: 'Maina',
    }).returning();

    const [m2] = await db.insert(members).values({
      memberNo: 'M-0002',
      firstName: 'Sarah',
      lastName: 'Cherono',
    }).returning();

    // Insert contributions for 2026-09
    await db.insert(contributions).values([
      {
        memberId: m1!.id,
        typeId: t1!.id,
        period: '2026-09',
        amountCents: 200000, // KES 2,000
        paidAt: new Date('2026-09-05'),
        method: 'mpesa',
      },
      {
        memberId: m1!.id,
        typeId: t2!.id,
        period: '2026-09',
        amountCents: 50000, // KES 500
        paidAt: new Date('2026-09-05'),
        method: 'mpesa',
      },
      {
        memberId: m2!.id,
        typeId: t1!.id,
        period: '2026-09',
        amountCents: 200000, // KES 2,000
        paidAt: new Date('2026-09-06'),
        method: 'cash',
      },
    ]);
  });

  it('aggregates monthly contributions by member and type', async () => {
    const summary = await getMonthlyContributionsSummary(db, '2026-09');

    expect(summary.period).toBe('2026-09');
    expect(summary.grandTotalCents).toBe(450000); // KES 4,500
    expect(summary.paymentMethodTotals.mpesa).toBe(250000);
    expect(summary.paymentMethodTotals.cash).toBe(200000);

    const m1Summary = summary.members.find((m) => m.memberNo === 'M-0001');
    expect(m1Summary?.totalCents).toBe(250000);
  });

  it('generates 12-month annual cross-tab matrix', async () => {
    const matrix = await getAnnualContributionsSummary(db, 2026);

    expect(matrix.year).toBe(2026);
    expect(matrix.grandTotalCents).toBe(450000);
    expect(matrix.monthTotals[9]).toBe(450000); // Month 9 (Sept)

    const m2Row = matrix.members.find((m) => m.memberNo === 'M-0002');
    expect(m2Row?.months[9]).toBe(200000);
    expect(m2Row?.totalCents).toBe(200000);
  });
});
