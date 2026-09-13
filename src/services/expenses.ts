import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { expenses, groupProjects, users, type Expense } from '../db/schema.js';

export const EXPENSE_CATEGORIES = [
  { id: 'meeting', name: 'Meeting & AGM Logistics', icon: '?' },
  { id: 'admin', name: 'Administration & Office', icon: '??' },
  { id: 'bank_charges', name: 'Bank & M-Pesa Transaction Charges', icon: '??' },
  { id: 'farm_inputs', name: 'Farm Inputs & Seedlings Bulk Purchase', icon: '??' },
  { id: 'project', name: 'Group Project Capital & Operational Cost', icon: '???' },
  { id: 'welfare', name: 'Member Welfare & Benevolence Payouts', icon: '??' },
  { id: 'audit_legal', name: 'Audit & Legal Compliance', icon: '??' },
  { id: 'other', name: 'Miscellaneous Expenses', icon: '??' },
] as const;

export const expenseInputSchema = z.object({
  expenseDate: z.coerce.date().default(() => new Date()),
  category: z.string().min(1, 'Category is required'),
  amountCents: z.number().int().positive('Amount must be positive'),
  payee: z.string().trim().min(1, 'Payee is required'),
  purpose: z.string().trim().optional(),
  description: z.string().trim().optional(),
  paymentMethod: z.enum(['cash', 'mpesa', 'bank', 'other']).default('mpesa'),
  receiptNumber: z.string().trim().optional(),
  referenceNo: z.string().trim().optional(),
  receiptPhotoUrl: z.string().trim().optional(),
  projectId: z.number().int().optional(),
  approvedBy: z.union([z.string(), z.number()]).optional(),
  recordedBy: z.union([z.string(), z.number()]).optional(),
  createdById: z.union([z.string(), z.number()]).optional(),
  notes: z.string().trim().optional(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export interface ExpenseFilters {
  category?: string;
  projectId?: number;
  year?: number;
  month?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  fromDate?: Date | string;
  toDate?: Date | string;
  limit?: number;
  offset?: number;
}

export interface ExpenseRecordWithRelations {
  expense: Expense;
  project: typeof groupProjects.$inferSelect | null;
  recorder: typeof users.$inferSelect | null;
  approver: typeof users.$inferSelect | null;
}

export async function createExpense(db: Db, rawInput: ExpenseInput | Record<string, any>): Promise<Expense> {
  const input = expenseInputSchema.parse(rawInput);
  const now = new Date();
  const purpose = input.purpose || input.description || 'Expense';
  const receiptNumber = input.receiptNumber || input.referenceNo || null;
  const recordedBy = input.recordedBy ? Number(input.recordedBy) : (input.createdById ? Number(input.createdById) : null);
  const approvedBy = input.approvedBy ? Number(input.approvedBy) : null;

  const [created] = await db
    .insert(expenses)
    .values({
      expenseDate: input.expenseDate,
      category: input.category,
      amountCents: input.amountCents,
      payee: input.payee,
      purpose,
      paymentMethod: input.paymentMethod,
      receiptNumber,
      receiptPhotoUrl: input.receiptPhotoUrl || null,
      projectId: input.projectId || null,
      approvedBy,
      recordedBy,
      notes: input.notes || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created!;
}

export async function listExpenses(
  db: Db,
  filters: ExpenseFilters = {},
): Promise<ExpenseRecordWithRelations[]> {
  const conditions = [];

  if (filters.category) {
    conditions.push(eq(expenses.category, filters.category));
  }
  if (filters.projectId) {
    conditions.push(eq(expenses.projectId, filters.projectId));
  }
  if (filters.year) {
    const start = new Date(filters.year, (filters.month ? filters.month - 1 : 0), 1);
    const end = filters.month
      ? new Date(filters.year, filters.month, 0, 23, 59, 59)
      : new Date(filters.year, 11, 31, 23, 59, 59);
    conditions.push(and(gte(expenses.expenseDate, start), lte(expenses.expenseDate, end)));
  } else if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    conditions.push(and(gte(expenses.expenseDate, start), lte(expenses.expenseDate, end)));
  } else if (filters.fromDate && filters.toDate) {
    const start = new Date(filters.fromDate);
    const end = new Date(filters.toDate);
    conditions.push(and(gte(expenses.expenseDate, start), lte(expenses.expenseDate, end)));
  }

  const query = db
    .select({
      expense: expenses,
      project: groupProjects,
      recorder: users,
    })
    .from(expenses)
    .leftJoin(groupProjects, eq(expenses.projectId, groupProjects.id))
    .leftJoin(users, eq(expenses.recordedBy, users.id))
    .orderBy(desc(expenses.expenseDate), desc(expenses.id));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }
  if (filters.limit) {
    query.limit(filters.limit);
  }
  if (filters.offset) {
    query.offset(filters.offset);
  }

  const rows = await query.all();
  return rows.map((r) => ({
    expense: r.expense,
    project: r.project,
    recorder: r.recorder,
    approver: null,
  }));
}

export async function getExpenseById(db: Db, id: number): Promise<ExpenseRecordWithRelations | null> {
  const row = await db
    .select({
      expense: expenses,
      project: groupProjects,
      recorder: users,
    })
    .from(expenses)
    .leftJoin(groupProjects, eq(expenses.projectId, groupProjects.id))
    .leftJoin(users, eq(expenses.recordedBy, users.id))
    .where(eq(expenses.id, id))
    .get();

  if (!row) return null;

  return {
    expense: row.expense,
    project: row.project,
    recorder: row.recorder,
    approver: null,
  };
}

export async function deleteExpense(db: Db, id: number): Promise<boolean> {
  const result = await db.delete(expenses).where(eq(expenses.id, id)).returning();
  return result.length > 0;
}

export async function getExpenseSummary(
  db: Db,
  filters: { year?: number; month?: number; fromDate?: Date | string; toDate?: Date | string } = {},
) {
  const conditions = [];
  if (filters.year) {
    const start = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
    const end = filters.month
      ? new Date(filters.year, filters.month, 0, 23, 59, 59)
      : new Date(filters.year, 11, 31, 23, 59, 59);
    conditions.push(and(gte(expenses.expenseDate, start), lte(expenses.expenseDate, end)));
  } else if (filters.fromDate && filters.toDate) {
    const start = new Date(filters.fromDate);
    const end = new Date(filters.toDate);
    conditions.push(and(gte(expenses.expenseDate, start), lte(expenses.expenseDate, end)));
  }

  const categoryTotals = await db
    .select({
      category: expenses.category,
      totalCents: sql<number>`sum(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(expenses.category)
    .all();

  const totalCents = categoryTotals.reduce((sum, c) => sum + Number(c.totalCents || 0), 0);
  const totalCount = categoryTotals.reduce((sum, c) => sum + Number(c.count || 0), 0);

  const byCategoryMap: Record<string, number> = {};
  for (const c of categoryTotals) {
    byCategoryMap[c.category] = Number(c.totalCents || 0);
  }

  return {
    totalCents,
    totalCount,
    totalAmountCents: totalCents,
    byCategory: byCategoryMap,
    categoriesList: categoryTotals.map((c) => ({
      category: c.category,
      totalCents: Number(c.totalCents || 0),
      count: Number(c.count || 0),
    })),
  };
}
