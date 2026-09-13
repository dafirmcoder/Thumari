import { eq, desc, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  groupProjects,
  projectIncomes,
  expenses,
  users,
  type GroupProject,
  type ProjectIncome,
} from '../db/schema.js';

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required'),
  code: z.string().trim().optional(),
  description: z.string().trim().optional(),
  status: z.enum(['planning', 'active', 'completed', 'suspended']).default('active'),
  startDate: z.coerce.date().optional(),
  targetBudgetCents: z.number().int().optional().default(0),
  budgetCents: z.number().int().optional(),
  leadMemberName: z.string().trim().optional(),
  category: z.string().trim().optional(),
  createdBy: z.union([z.string(), z.number()]).optional(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectIncomeInputSchema = z.object({
  projectId: z.number().int().positive(),
  incomeDate: z.coerce.date().default(() => new Date()),
  source: z.string().trim().optional(),
  sourceOrBuyer: z.string().trim().optional(),
  amountCents: z.number().int().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'mpesa', 'bank', 'other']).default('mpesa'),
  receiptNo: z.string().trim().optional(),
  referenceNo: z.string().trim().optional(),
  recordedBy: z.union([z.string(), z.number()]).optional(),
  recordedById: z.union([z.string(), z.number()]).optional(),
  notes: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type ProjectIncomeInput = z.infer<typeof projectIncomeInputSchema>;

export interface ProjectFinancials {
  project: GroupProject;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netProfitCents: number;
  incomeCount: number;
  expenseCount: number;
  budgetUtilizationPct: number;
}

export async function createProject(db: Db, rawInput: ProjectInput | Record<string, any>): Promise<GroupProject> {
  const input = projectInputSchema.parse(rawInput);
  const now = new Date();
  const code = (input.code || input.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6) || 'PROJ').toUpperCase();
  const budget = input.targetBudgetCents || input.budgetCents || 0;
  const createdBy = input.createdBy ? Number(input.createdBy) : null;

  const [created] = await db
    .insert(groupProjects)
    .values({
      name: input.name,
      code,
      description: input.description || null,
      status: input.status,
      startDate: input.startDate || null,
      targetBudgetCents: budget,
      createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created!;
}

export async function listProjects(
  db: Db,
  filters: { status?: 'planning' | 'active' | 'completed' | 'suspended' } = {},
): Promise<ProjectFinancials[]> {
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(groupProjects.status, filters.status));
  }

  const allProjects = await db
    .select()
    .from(groupProjects)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(groupProjects.id))
    .all();

  const results: ProjectFinancials[] = [];
  for (const p of allProjects) {
    const fin = await getProjectFinancials(db, p.id);
    if (fin) {
      results.push(fin);
    }
  }

  return results;
}

export async function getProjectById(db: Db, id: number): Promise<GroupProject | null> {
  return (await db.select().from(groupProjects).where(eq(groupProjects.id, id)).get()) ?? null;
}

export async function recordProjectIncome(db: Db, rawInput: ProjectIncomeInput | Record<string, any>): Promise<ProjectIncome> {
  const input = projectIncomeInputSchema.parse(rawInput);
  const source = input.source || input.sourceOrBuyer || 'Project Revenue';
  const receiptNo = input.receiptNo || input.referenceNo || null;
  const notes = input.notes || input.description || null;
  const recordedBy = input.recordedBy ? Number(input.recordedBy) : (input.recordedById ? Number(input.recordedById) : null);

  const [income] = await db
    .insert(projectIncomes)
    .values({
      projectId: input.projectId,
      incomeDate: input.incomeDate,
      source,
      amountCents: input.amountCents,
      paymentMethod: input.paymentMethod,
      receiptNo,
      recordedBy,
      notes,
      createdAt: new Date(),
    })
    .returning();

  return income!;
}

export async function listProjectIncomes(db: Db, projectId: number) {
  return await db
    .select({
      income: projectIncomes,
      recorder: users,
    })
    .from(projectIncomes)
    .leftJoin(users, eq(projectIncomes.recordedBy, users.id))
    .where(eq(projectIncomes.projectId, projectId))
    .orderBy(desc(projectIncomes.incomeDate), desc(projectIncomes.id))
    .all();
}

export async function getProjectFinancials(db: Db, projectId: number): Promise<ProjectFinancials | null> {
  const project = await getProjectById(db, projectId);
  if (!project) return null;

  const incomeRow = await db
    .select({
      total: sql<number>`sum(${projectIncomes.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(projectIncomes)
    .where(eq(projectIncomes.projectId, projectId))
    .get();

  const expenseRow = await db
    .select({
      total: sql<number>`sum(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(eq(expenses.projectId, projectId))
    .get();

  const totalIncomeCents = Number(incomeRow?.total || 0);
  const incomeCount = Number(incomeRow?.count || 0);
  const totalExpenseCents = Number(expenseRow?.total || 0);
  const expenseCount = Number(expenseRow?.count || 0);
  const netProfitCents = totalIncomeCents - totalExpenseCents;

  const budget = project.targetBudgetCents || 0;
  const budgetUtilizationPct = budget > 0 ? Math.round((totalExpenseCents / budget) * 100) : 0;

  return {
    project,
    totalIncomeCents,
    totalExpenseCents,
    netProfitCents,
    incomeCount,
    expenseCount,
    budgetUtilizationPct,
  };
}

export async function getAllProjectsTotalIncome(db: Db, year?: number): Promise<number> {
  const conditions = [];
  if (year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    conditions.push(and(sql`${projectIncomes.incomeDate} >= ${start.getTime()}`, sql`${projectIncomes.incomeDate} <= ${end.getTime()}`));
  }

  const row = await db
    .select({ total: sql<number>`sum(${projectIncomes.amountCents})` })
    .from(projectIncomes)
    .where(conditions.length ? and(...conditions) : undefined)
    .get();

  return Number(row?.total || 0);
}
