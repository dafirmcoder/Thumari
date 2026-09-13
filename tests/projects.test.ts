import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, applyMigrations, type Db } from '../src/db/index.js';
import {
  createProject,
  listProjects,
  getProjectById,
  recordProjectIncome,
  listProjectIncomes,
  getProjectFinancials,
} from '../src/services/projects.js';
import { createExpense } from '../src/services/expenses.js';
import { users } from '../src/db/schema.js';

describe('Group Projects Service', () => {
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

  it('creates and retrieves a project portfolio item', async () => {
    const p = await createProject(db, {
      name: 'Honey Production & Bottling',
      description: 'Community apiary with 50 beehives in Kangema',
      category: 'commercial',
      budgetCents: 15000000, // KES 150,000
      startDate: new Date('2026-02-01'),
      status: 'active',
      leadMemberName: 'Peter Mwangi',
    });

    expect(p.id).toBeDefined();
    expect(p.name).toBe('Honey Production & Bottling');

    const fetched = await getProjectById(db, p.id);
    expect(fetched?.targetBudgetCents).toBe(15000000);
  });

  it('records project income and tracks P&L accurately against expenses', async () => {
    const project = await createProject(db, {
      name: 'Tractor Ploughing Hire',
      category: 'asset_hire',
      budgetCents: 30000000,
    });

    // Incomes
    await recordProjectIncome(db, {
      projectId: project.id,
      incomeDate: new Date('2026-04-10'),
      sourceOrBuyer: 'Farm Cluster A',
      description: 'Ploughing 20 acres',
      amountCents: 6000000, // KES 60,000
      paymentMethod: 'mpesa',
      referenceNo: 'REC-001',
      recordedById: adminUserId,
    });

    await recordProjectIncome(db, {
      projectId: project.id,
      incomeDate: new Date('2026-04-15'),
      sourceOrBuyer: 'Farm Cluster B',
      description: 'Ploughing 15 acres',
      amountCents: 4500000, // KES 45,000
      paymentMethod: 'cash',
      recordedById: adminUserId,
    });

    // Direct Expenses
    await createExpense(db, {
      expenseDate: new Date('2026-04-05'),
      category: 'project_cost',
      amountCents: 2500000, // KES 25,000 diesel
      payee: 'Shell Kangema',
      paymentMethod: 'mpesa',
      projectId: project.id,
      createdById: adminUserId,
    });

    await createExpense(db, {
      expenseDate: new Date('2026-04-12'),
      category: 'project_cost',
      amountCents: 1000000, // KES 10,000 operator wage
      payee: 'John Driver',
      paymentMethod: 'cash',
      projectId: project.id,
      createdById: adminUserId,
    });

    const incomes = await listProjectIncomes(db, project.id);
    expect(incomes.length).toBe(2);

    const fin = await getProjectFinancials(db, project.id);
    expect(fin?.totalIncomeCents).toBe(10500000); // KES 105,000
    expect(fin?.totalExpenseCents).toBe(3500000);  // KES 35,000
    expect(fin?.netProfitCents).toBe(7000000);     // KES 70,000 net profit
  });
});
