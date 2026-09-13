import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, applyMigrations, type Db } from '../src/db/index.js';
import { createExpense, listExpenses, getExpenseSummary, deleteExpense } from '../src/services/expenses.js';
import { createProject } from '../src/services/projects.js';
import { users } from '../src/db/schema.js';

describe('Expenses Service', () => {
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
  });

  it('creates and lists expenses with categorization', async () => {
    const exp1 = await createExpense(db, {
      expenseDate: new Date('2026-09-01'),
      category: 'stationery',
      amountCents: 150000, // KES 1,500
      payee: 'Chuka Bookshop',
      paymentMethod: 'mpesa',
      referenceNo: 'QK12345678',
      description: 'Receipt books and registers',
      createdById: adminUserId,
    });

    const exp2 = await createExpense(db, {
      expenseDate: new Date('2026-09-05'),
      category: 'refreshments',
      amountCents: 320000, // KES 3,200
      payee: 'Mukurwe-ini Bakery',
      paymentMethod: 'cash',
      description: 'Tea and snacks for AGM',
      createdById: adminUserId,
    });

    expect(exp1.id).toBeDefined();
    expect(exp2.id).toBeDefined();

    const allExpenses = await listExpenses(db);
    expect(allExpenses.length).toBe(2);

    const stationeryOnly = await listExpenses(db, { category: 'stationery' });
    expect(stationeryOnly.length).toBe(1);
    expect(stationeryOnly[0]?.expense.payee).toBe('Chuka Bookshop');
  });

  it('links expenses to group projects when project id provided', async () => {
    const project = await createProject(db, {
      name: 'Bulk Fertilizer 2026',
      category: 'commercial',
      budgetCents: 50000000,
    });

    const exp = await createExpense(db, {
      expenseDate: new Date('2026-09-10'),
      category: 'project_cost',
      amountCents: 4500000, // KES 45,000
      payee: 'KFA Nyeri',
      paymentMethod: 'bank',
      description: 'Fertilizer transport charges',
      projectId: project.id,
      createdById: adminUserId,
    });

    expect(exp.projectId).toBe(project.id);

    const projectExpenses = await listExpenses(db, { projectId: project.id });
    expect(projectExpenses.length).toBe(1);
    expect(projectExpenses[0]?.expense.amountCents).toBe(4500000);
  });

  it('computes category breakdowns and grand totals in summary', async () => {
    await createExpense(db, {
      expenseDate: new Date('2026-08-15'),
      category: 'hall_hire',
      amountCents: 500000, // KES 5,000
      payee: 'Community Hall',
      paymentMethod: 'cash',
      createdById: adminUserId,
    });

    await createExpense(db, {
      expenseDate: new Date('2026-09-02'),
      category: 'stationery',
      amountCents: 200000, // KES 2,000
      payee: 'Office Mart',
      paymentMethod: 'mpesa',
      createdById: adminUserId,
    });

    const summary = await getExpenseSummary(db, { fromDate: '2026-08-01', toDate: '2026-09-30' });
    expect(summary.totalCount).toBe(2);
    expect(summary.totalAmountCents).toBe(700000); // KES 7,000
    expect(summary.byCategory['hall_hire']).toBe(500000);
    expect(summary.byCategory['stationery']).toBe(200000);
  });

  it('deletes an expense record cleanly', async () => {
    const exp = await createExpense(db, {
      expenseDate: new Date('2026-09-12'),
      category: 'bank_charges',
      amountCents: 5000,
      payee: 'Co-op Bank',
      paymentMethod: 'bank',
      createdById: adminUserId,
    });

    const listBefore = await listExpenses(db);
    expect(listBefore.length).toBe(1);

    await deleteExpense(db, exp.id);
    const listAfter = await listExpenses(db);
    expect(listAfter.length).toBe(0);
  });
});
