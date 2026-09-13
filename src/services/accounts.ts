import { eq, and, sql, gte, lte } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  contributions,
  contributionTypes,
  projectIncomes,
  groupProjects,
  expenses,
  fines,
  loanRepayments,
  loans,
} from '../db/schema.js';

export interface AccountsReportOptions {
  year?: number;
  month?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  fromDate?: Date | string;
  toDate?: Date | string;
}

export interface InflowBreakdown {
  contributionsByType: Array<{ typeId: number; name: string; kind: string; totalCents: number }>;
  totalContributionsCents: number;
  contributionsTotalCents?: number;
  projectIncomesByProject: Array<{ projectId: number; projectName: string; totalCents: number }>;
  totalProjectIncomesCents: number;
  projectIncomeTotalCents?: number;
  loanInterestRepaymentsCents: number;
  finesCollectedCents: number;
  totalInflowsCents: number;
}

export interface OutflowBreakdown {
  expensesByCategory: Array<{ category: string; totalCents: number; count: number }>;
  totalOperatingExpensesCents: number;
  expensesTotalCents?: number;
  projectDirectExpensesCents: number;
  loansDisbursedCents: number;
  totalOutflowsCents: number;
}

export interface MonthFinancialSummary {
  monthIndex: number; // 1-12
  monthName: string;
  contributionsCents: number;
  projectIncomesCents: number;
  totalInflowsCents: number;
  operatingExpensesCents: number;
  totalOutflowsCents: number;
  netSurplusCents: number;
}

export interface AccountsReportData {
  year: number;
  month?: number;
  periodLabel: string;
  inflows: InflowBreakdown;
  outflows: OutflowBreakdown;
  netOperatingSurplusCents: number;
  netSurplusCents: number;
  netCashFlowCents: number;
  monthlyTrend: MonthFinancialSummary[];
}

export async function getAccountsReport(
  db: Db,
  options: AccountsReportOptions = {},
): Promise<AccountsReportData> {
  const currentYear = options.year || new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

  let periodStart = startOfYear;
  let periodEnd = endOfYear;
  let periodLabel = `Annual Statement (${currentYear})`;

  if (options.month) {
    periodStart = new Date(currentYear, options.month - 1, 1);
    periodEnd = new Date(currentYear, options.month, 0, 23, 59, 59);
    const mName = periodStart.toLocaleString('en-KE', { month: 'long' });
    periodLabel = `${mName} ${currentYear}`;
  } else if (options.startDate && options.endDate) {
    periodStart = new Date(options.startDate);
    periodEnd = new Date(options.endDate);
    periodLabel = `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`;
  } else if (options.fromDate && options.toDate) {
    periodStart = new Date(options.fromDate);
    periodEnd = new Date(options.toDate);
    periodLabel = `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`;
  }

  // 1. INFLOWS
  // 1a. Member Contributions by Type
  const contribRows = await db
    .select({
      typeId: contributionTypes.id,
      name: contributionTypes.name,
      kind: contributionTypes.kind,
      totalCents: sql<number>`sum(${contributions.amountCents})`,
    })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(and(gte(contributions.paidAt, periodStart), lte(contributions.paidAt, periodEnd)))
    .groupBy(contributionTypes.id)
    .all();

  const contributionsByType = contribRows.map((r) => ({
    typeId: r.typeId,
    name: r.name,
    kind: r.kind,
    totalCents: Number(r.totalCents || 0),
  }));
  const totalContributionsCents = contributionsByType.reduce((s, c) => s + c.totalCents, 0);

  // 1b. Project Incomes by Project
  const projectIncomeRows = await db
    .select({
      projectId: groupProjects.id,
      projectName: groupProjects.name,
      totalCents: sql<number>`sum(${projectIncomes.amountCents})`,
    })
    .from(projectIncomes)
    .innerJoin(groupProjects, eq(projectIncomes.projectId, groupProjects.id))
    .where(and(gte(projectIncomes.incomeDate, periodStart), lte(projectIncomes.incomeDate, periodEnd)))
    .groupBy(groupProjects.id)
    .all();

  const projectIncomesByProject = projectIncomeRows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName,
    totalCents: Number(r.totalCents || 0),
  }));
  const totalProjectIncomesCents = projectIncomesByProject.reduce((s, p) => s + p.totalCents, 0);

  // 1c. Loan Repayments & Fines
  const finesRow = await db
    .select({ total: sql<number>`sum(${fines.amountCents})` })
    .from(fines)
    .where(and(eq(fines.status, 'paid'), gte(fines.paidAt, periodStart), lte(fines.paidAt, periodEnd)))
    .get();
  const finesCollectedCents = Number(finesRow?.total || 0);

  const loanRepaymentsRow = await db
    .select({ total: sql<number>`sum(${loanRepayments.amountCents})` })
    .from(loanRepayments)
    .where(and(gte(loanRepayments.paidAt, periodStart), lte(loanRepayments.paidAt, periodEnd)))
    .get();
  const loanInterestRepaymentsCents = Number(loanRepaymentsRow?.total || 0);

  const totalInflowsCents = totalContributionsCents + totalProjectIncomesCents + finesCollectedCents + loanInterestRepaymentsCents;

  // 2. OUTFLOWS
  // 2a. Operating Expenses by Category
  const expenseRows = await db
    .select({
      category: expenses.category,
      totalCents: sql<number>`sum(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, periodStart), lte(expenses.expenseDate, periodEnd)))
    .groupBy(expenses.category)
    .all();

  const expensesByCategory = expenseRows.map((r) => ({
    category: r.category,
    totalCents: Number(r.totalCents || 0),
    count: Number(r.count || 0),
  }));
  const totalOperatingExpensesCents = expensesByCategory.reduce((s, e) => s + e.totalCents, 0);

  // Project direct expenses
  const projectExpenseRow = await db
    .select({ total: sql<number>`sum(${expenses.amountCents})` })
    .from(expenses)
    .where(and(sql`${expenses.projectId} IS NOT NULL`, gte(expenses.expenseDate, periodStart), lte(expenses.expenseDate, periodEnd)))
    .get();
  const projectDirectExpensesCents = Number(projectExpenseRow?.total || 0);

  // Loans Disbursed
  const disbursedRow = await db
    .select({ total: sql<number>`sum(${loans.principalCents})` })
    .from(loans)
    .where(and(eq(loans.status, 'disbursed'), gte(loans.disbursedAt, periodStart), lte(loans.disbursedAt, periodEnd)))
    .get();
  const loansDisbursedCents = Number(disbursedRow?.total || 0);

  const totalOutflowsCents = totalOperatingExpensesCents + loansDisbursedCents;

  // 3. NET CALCULATIONS
  // Net Operating Surplus = Inflows from Operations (Contributions + Projects + Fines) - Operating Expenses
  const netOperatingSurplusCents = (totalContributionsCents + totalProjectIncomesCents + finesCollectedCents) - totalOperatingExpensesCents;
  const netCashFlowCents = totalInflowsCents - totalOutflowsCents;

  // 4. MONTHLY TREND (12 months of year)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrend: MonthFinancialSummary[] = [];

  for (let m = 1; m <= 12; m++) {
    const mStart = new Date(currentYear, m - 1, 1);
    const mEnd = new Date(currentYear, m, 0, 23, 59, 59);

    const mContrib = await db
      .select({ total: sql<number>`sum(${contributions.amountCents})` })
      .from(contributions)
      .where(and(gte(contributions.paidAt, mStart), lte(contributions.paidAt, mEnd)))
      .get();
    const mProject = await db
      .select({ total: sql<number>`sum(${projectIncomes.amountCents})` })
      .from(projectIncomes)
      .where(and(gte(projectIncomes.incomeDate, mStart), lte(projectIncomes.incomeDate, mEnd)))
      .get();
    const mExpense = await db
      .select({ total: sql<number>`sum(${expenses.amountCents})` })
      .from(expenses)
      .where(and(gte(expenses.expenseDate, mStart), lte(expenses.expenseDate, mEnd)))
      .get();

    const contribCents = Number(mContrib?.total || 0);
    const projectCents = Number(mProject?.total || 0);
    const expenseCents = Number(mExpense?.total || 0);

    const mInflows = contribCents + projectCents;
    const mOutflows = expenseCents;

    monthlyTrend.push({
      monthIndex: m,
      monthName: monthNames[m - 1]!,
      contributionsCents: contribCents,
      projectIncomesCents: projectCents,
      totalInflowsCents: mInflows,
      operatingExpensesCents: expenseCents,
      totalOutflowsCents: mOutflows,
      netSurplusCents: mInflows - mOutflows,
    });
  }

  return {
    year: currentYear,
    month: options.month,
    periodLabel,
    inflows: {
      contributionsByType,
      totalContributionsCents,
      contributionsTotalCents: totalContributionsCents,
      projectIncomesByProject,
      totalProjectIncomesCents,
      projectIncomeTotalCents: totalProjectIncomesCents,
      loanInterestRepaymentsCents,
      finesCollectedCents,
      totalInflowsCents,
    },
    outflows: {
      expensesByCategory,
      totalOperatingExpensesCents,
      expensesTotalCents: totalOperatingExpensesCents,
      projectDirectExpensesCents,
      loansDisbursedCents,
      totalOutflowsCents,
    },
    netOperatingSurplusCents,
    netSurplusCents: netOperatingSurplusCents,
    netCashFlowCents,
    monthlyTrend,
  };
}
