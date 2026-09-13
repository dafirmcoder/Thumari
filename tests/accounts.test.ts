import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, applyMigrations, type Db } from '../src/db/index.js';
import { getAccountsReport } from '../src/services/accounts.js';
import { members, contributionTypes, contributions, users } from '../src/db/schema.js';
import { createProject, recordProjectIncome } from '../src/services/projects.js';
import { createExpense } from '../src/services/expenses.js';

describe('Accounts Financial Report Service', () => {
  let db: Db;
  let adminUserId: string;

  beforeEach(async () => {
    const handle = createDatabase(':memory:');
    db = handle.db;
    await applyMigrations(db);

    const [u] = await db.insert(users).values({
      email: 'admin@thumari.local',
      name: 'Admin User',
      passwordHash: 'hash',
      role: 'admin',
    }).returning();
    adminUserId = String(u!.id);

    const [savingsType] = await db.insert(contributionTypes).values({
      name: 'Monthly Savings',
      kind: 'savings',
      defaultAmountCents: 200000,
    }).returning();

    const [m1] = await db.insert(members).values({
      memberNo: 'M-0001',
      firstName: 'Alice',
      lastName: 'Wanjiru',
    }).returning();

    // 1. Contribution Inflow: KES 50,000 in 2026-06
    await db.insert(contributions).values({
      memberId: m1!.id,
      typeId: savingsType!.id,
      period: '2026-06',
      amountCents: 5000000,
      paidAt: new Date('2026-06-15'),
      method: 'mpesa',
    });

    // 2. Commercial Project Inflow: KES 30,000 in 2026-06
    const proj = await createProject(db, {
      name: 'Seedling Nursery',
      category: 'commercial',
      budgetCents: 10000000,
    });

    await recordProjectIncome(db, {
      projectId: proj.id,
      incomeDate: '2026-06-20',
      sourceOrBuyer: 'Local Farmers',
      description: 'Seedling sales',
      amountCents: 3000000,
      paymentMethod: 'mpesa',
      recordedById: adminUserId,
    });

    // 3. Operating Expense: KES 8,000 in 2026-06
    await createExpense(db, {
      expenseDate: '2026-06-10',
      category: 'stationery',
      amountCents: 800000,
      payee: 'Bookshop',
      paymentMethod: 'cash',
      createdById: adminUserId,
    });

    // 4. Project Expense: KES 12,000 in 2026-06
    await createExpense(db, {
      expenseDate: '2026-06-18',
      category: 'project_cost',
      amountCents: 1200000,
      payee: 'Soil & Pots Supplier',
      paymentMethod: 'bank',
      projectId: proj.id,
      createdById: adminUserId,
    });
  });

  it('aggregates total revenues, expenses, and net surplus accurately for the period', async () => {
    const report = await getAccountsReport(db, { fromDate: '2026-01-01', toDate: '2026-12-31' });

    // Inflows = 50,000 (contributions) + 30,000 (projects) = KES 80,000 (8,000,000 cents)
    expect(report.inflows.totalInflowsCents).toBe(8000000);
    expect(report.inflows.contributionsTotalCents).toBe(5000000);
    expect(report.inflows.projectIncomeTotalCents).toBe(3000000);

    // Outflows = 8,000 (stationery) + 12,000 (project cost) = KES 20,000 (2,000,000 cents)
    expect(report.outflows.totalOutflowsCents).toBe(2000000);
    expect(report.outflows.expensesTotalCents).toBe(2000000);

    // Net Operating Surplus = 80,000 - 20,000 = KES 60,000 (6,000,000 cents)
    expect(report.netSurplusCents).toBe(6000000);
  });
});
