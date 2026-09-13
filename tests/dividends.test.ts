import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, applyMigrations, type Db } from '../src/db/index.js';
import { calculateDividends } from '../src/services/dividends.js';
import { members, contributionTypes, contributions } from '../src/db/schema.js';

describe('Dividends Calculator Service', () => {
  let db: Db;

  beforeEach(async () => {
    const handle = createDatabase(':memory:');
    db = handle.db;
    await applyMigrations(db);

    const [savingsType] = await db.insert(contributionTypes).values({
      name: 'Monthly Savings',
      kind: 'savings',
      defaultAmountCents: 200000,
    }).returning();

    const [sharesType] = await db.insert(contributionTypes).values({
      name: 'Share Capital',
      kind: 'shares',
      defaultAmountCents: 100000,
    }).returning();

    const [welfareType] = await db.insert(contributionTypes).values({
      name: 'Welfare Fund',
      kind: 'welfare', // Welfare does not earn dividends
      defaultAmountCents: 50000,
    }).returning();

    const [m1] = await db.insert(members).values({
      memberNo: 'M-0001',
      firstName: 'David',
      lastName: 'Kamau',
      status: 'active',
    }).returning();

    const [m2] = await db.insert(members).values({
      memberNo: 'M-0002',
      firstName: 'Jane',
      lastName: 'Wambui',
      status: 'active',
    }).returning();

    // M1 has KES 60,000 savings + KES 40,000 shares = KES 100,000 qualifying
    await db.insert(contributions).values([
      {
        memberId: m1!.id,
        typeId: savingsType!.id,
        period: '2026-01',
        amountCents: 6000000,
        paidAt: new Date('2026-01-10'),
        method: 'mpesa',
      },
      {
        memberId: m1!.id,
        typeId: sharesType!.id,
        period: '2026-01',
        amountCents: 4000000,
        paidAt: new Date('2026-01-10'),
        method: 'bank',
      },
      {
        memberId: m1!.id,
        typeId: welfareType!.id,
        period: '2026-01',
        amountCents: 500000, // KES 5,000 welfare (should not count for dividend pool)
        paidAt: new Date('2026-01-10'),
        method: 'cash',
      },
    ]);

    // M2 has KES 300,000 savings = KES 300,000 qualifying
    await db.insert(contributions).values([
      {
        memberId: m2!.id,
        typeId: savingsType!.id,
        period: '2026-01',
        amountCents: 30000000,
        paidAt: new Date('2026-01-12'),
        method: 'mpesa',
      },
    ]);
  });

  it('calculates pro-rata dividends based strictly on member savings & shares contributions', async () => {
    // Total qualifying capital = 100,000 + 300,000 = KES 400,000
    // Distributable profit pool = KES 100,000 (10,000,000 cents)
    // Retained reserves = 10% -> Net pool = KES 90,000 (9,000,000 cents)
    // Withholding tax = 5%
    const result = await calculateDividends(db, {
      totalProfitPoolCents: 10000000,
      retainedEarningsPercent: 10,
      withholdingTaxPercent: 5,
    });

    expect(result.totalQualifyingContributionsCents).toBe(40000000); // KES 400,000
    expect(result.distributableDividendCents).toBe(9000000);         // KES 90,000
    expect(result.retainedReservesCents).toBe(1000000);            // KES 10,000

    // M1 has 25% share of qualifying capital
    const m1Alloc = result.memberAllocations.find((m) => m.memberNo === 'M-0001');
    expect(m1Alloc).toBeDefined();
    expect(m1Alloc?.contributionSharePercent).toBe(25);
    expect(m1Alloc?.grossDividendCents).toBe(2250000); // 25% of 90,000 = KES 22,500
    expect(m1Alloc?.withholdingTaxCents).toBe(112500); // 5% of 22,500 = KES 1,125
    expect(m1Alloc?.netDividendPayableCents).toBe(2137500); // KES 21,375

    // M2 has 75% share of qualifying capital
    const m2Alloc = result.memberAllocations.find((m) => m.memberNo === 'M-0002');
    expect(m2Alloc).toBeDefined();
    expect(m2Alloc?.contributionSharePercent).toBe(75);
    expect(m2Alloc?.grossDividendCents).toBe(6750000); // 75% of 90,000 = KES 67,500
    expect(m2Alloc?.withholdingTaxCents).toBe(337500); // 5% of 67,500 = KES 3,375
    expect(m2Alloc?.netDividendPayableCents).toBe(6412500); // KES 64,125
  });

  it('handles zero profit or zero capital safely without division errors', async () => {
    const zeroProfit = await calculateDividends(db, {
      totalProfitPoolCents: 0,
      retainedEarningsPercent: 0,
      withholdingTaxPercent: 0,
    });

    expect(zeroProfit.distributableDividendCents).toBe(0);
    expect(zeroProfit.memberAllocations[0]?.grossDividendCents).toBe(0);
  });
});
