import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  members,
  contributions,
  contributionTypes,
  loans,
  loanSchedule,
  meetings,
  coffeeProduce,
} from '../db/schema.js';
import { periodKey } from '../lib/dates.js';

export interface DashboardSummary {
  activeMemberCount: number;
  totalSavingsCents: number;
  thisMonthSavingsCents: number;
  activeLoanCount: number;
  totalOutstandingLoanCents: number;
  overdueInstallmentCents: number;
  upcomingMeeting: typeof meetings.$inferSelect | null;
  totalCoffeeKg: number;
  pendingCoffeeDeliveries: number;
}

export async function getDashboardSummary(db: Db, timezone: string): Promise<DashboardSummary> {
  const currentPeriod = periodKey(new Date(), timezone);

  // 1. Members count
  const memberRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.status, 'active'))
    .get();
  const activeMemberCount = Number(memberRes?.count || 0);

  // 2. Total group savings
  const totalSavingsRes = await db
    .select({ total: sql<number>`sum(${contributions.amountCents})` })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(eq(contributionTypes.kind, 'savings'))
    .get();
  const totalSavingsCents = Number(totalSavingsRes?.total || 0);

  // 3. This month savings
  const thisMonthRes = await db
    .select({ total: sql<number>`sum(${contributions.amountCents})` })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(and(eq(contributionTypes.kind, 'savings'), eq(contributions.period, currentPeriod)))
    .get();
  const thisMonthSavingsCents = Number(thisMonthRes?.total || 0);

  // 4. Loans summary
  const activeLoans = await db
    .select({
      count: sql<number>`count(*)`,
      outstanding: sql<number>`sum(${loans.outstandingCents})`,
    })
    .from(loans)
    .where(eq(loans.status, 'disbursed'))
    .get();
  const activeLoanCount = Number(activeLoans?.count || 0);
  const totalOutstandingLoanCents = Number(activeLoans?.outstanding || 0);

  // 5. Overdue arrears
  const now = new Date();
  const overdueRes = await db
    .select({
      total: sql<number>`sum(${loanSchedule.totalCents} + ${loanSchedule.penaltyCents} - ${loanSchedule.paidCents})`,
    })
    .from(loanSchedule)
    .innerJoin(loans, eq(loanSchedule.loanId, loans.id))
    .where(
      and(
        eq(loans.status, 'disbursed'),
        sql`${loanSchedule.dueDate} < ${now.getTime()}`,
        sql`${loanSchedule.paidCents} < (${loanSchedule.totalCents} + ${loanSchedule.penaltyCents})`,
      ),
    )
    .get();
  const overdueInstallmentCents = Number(overdueRes?.total || 0);

  // 6. Upcoming meeting
  const upcomingMeeting = (await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.status, 'scheduled'), sql`${meetings.scheduledAt} >= ${now.getTime()}`))
    .orderBy(meetings.scheduledAt)
    .limit(1)
    .get()) ?? null;

  // 7. Coffee produce stats
  const coffeeRes = await db
    .select({
      totalKg: sql<number>`sum(${coffeeProduce.netKg})`,
      pendingCount: sql<number>`sum(case when ${coffeeProduce.status} = 'pending_verification' then 1 else 0 end)`,
    })
    .from(coffeeProduce)
    .get();
  const totalCoffeeKg = Number(coffeeRes?.totalKg || 0);
  const pendingCoffeeDeliveries = Number(coffeeRes?.pendingCount || 0);

  return {
    activeMemberCount,
    totalSavingsCents,
    thisMonthSavingsCents,
    activeLoanCount,
    totalOutstandingLoanCents,
    overdueInstallmentCents: Math.max(0, overdueInstallmentCents),
    upcomingMeeting,
    totalCoffeeKg,
    pendingCoffeeDeliveries,
  };
}

export async function getSavingsReportByProduct(db: Db) {
  return await db
    .select({
      typeName: contributionTypes.name,
      kind: contributionTypes.kind,
      totalCents: sql<number>`sum(${contributions.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .groupBy(contributionTypes.id)
    .all();
}

/**
 * Monthly Contributions Summary
 */
export interface MonthlyMemberSummary {
  memberId: number;
  memberNo: string;
  fullName: string;
  byType: Record<number, number>; // typeId -> amountCents
  totalCents: number;
}

export interface MonthlyContributionsReport {
  period: string; // YYYY-MM
  year: number;
  month: number;
  types: Array<typeof contributionTypes.$inferSelect>;
  members: MonthlyMemberSummary[];
  typeTotals: Record<number, number>;
  grandTotalCents: number;
  paymentMethodTotals: Record<string, number>;
}

export async function getMonthlyContributionsSummary(
  db: Db,
  period: string, // YYYY-MM
): Promise<MonthlyContributionsReport> {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr || '', 10) || new Date().getFullYear();
  const month = parseInt(monthStr || '', 10) || (new Date().getMonth() + 1);

  const allTypes = await db.select().from(contributionTypes).where(eq(contributionTypes.active, true)).all();
  const allMembers = await db.select().from(members).orderBy(members.memberNo).all();

  const contributionRows = await db
    .select({
      memberId: contributions.memberId,
      typeId: contributions.typeId,
      amountCents: contributions.amountCents,
      method: contributions.method,
    })
    .from(contributions)
    .where(eq(contributions.period, period))
    .all();

  const memberMap = new Map<number, MonthlyMemberSummary>();
  for (const m of allMembers) {
    memberMap.set(m.id, {
      memberId: m.id,
      memberNo: m.memberNo,
      fullName: `${m.firstName} ${m.lastName}`,
      byType: {},
      totalCents: 0,
    });
  }

  const typeTotals: Record<number, number> = {};
  let grandTotalCents = 0;
  const paymentMethodTotals: Record<string, number> = {
    cash: 0,
    mpesa: 0,
    bank: 0,
    other: 0,
  };

  for (const t of allTypes) {
    typeTotals[t.id] = 0;
  }

  for (const row of contributionRows) {
    let summary = memberMap.get(row.memberId);
    if (!summary) {
      const fallbackMember = allMembers.find((m) => m.id === row.memberId);
      summary = {
        memberId: row.memberId,
        memberNo: fallbackMember ? fallbackMember.memberNo : `M-${row.memberId}`,
        fullName: fallbackMember ? `${fallbackMember.firstName} ${fallbackMember.lastName}` : 'Unknown Member',
        byType: {},
        totalCents: 0,
      };
      memberMap.set(row.memberId, summary);
    }

    summary.byType[row.typeId] = (summary.byType[row.typeId] || 0) + row.amountCents;
    summary.totalCents += row.amountCents;

    typeTotals[row.typeId] = (typeTotals[row.typeId] || 0) + row.amountCents;
    grandTotalCents += row.amountCents;

    const mthd = row.method || 'cash';
    paymentMethodTotals[mthd] = (paymentMethodTotals[mthd] || 0) + row.amountCents;
  }

  return {
    period,
    year,
    month,
    types: allTypes,
    members: Array.from(memberMap.values()),
    typeTotals,
    grandTotalCents,
    paymentMethodTotals,
  };
}

/**
 * Annual Contributions Summary (12-Month Matrix)
 */
export interface AnnualMemberRow {
  memberId: number;
  memberNo: string;
  fullName: string;
  months: Record<number, number>; // 1..12 -> amountCents
  totalCents: number;
}

export interface AnnualContributionsReport {
  year: number;
  members: AnnualMemberRow[];
  monthTotals: Record<number, number>; // 1..12 -> amountCents
  grandTotalCents: number;
  typeBreakdown: Array<{
    typeId: number;
    typeName: string;
    kind: string;
    totalCents: number;
  }>;
}

export async function getAnnualContributionsSummary(
  db: Db,
  year: number,
): Promise<AnnualContributionsReport> {
  const startOfYearStr = `${year}-01`;
  const endOfYearStr = `${year}-12`;

  const allMembers = await db.select().from(members).orderBy(members.memberNo).all();
  const allTypes = await db.select().from(contributionTypes).all();

  const rows = await db
    .select({
      memberId: contributions.memberId,
      typeId: contributions.typeId,
      period: contributions.period,
      amountCents: contributions.amountCents,
      paidAt: contributions.paidAt,
    })
    .from(contributions)
    .where(and(gte(contributions.period, startOfYearStr), lte(contributions.period, endOfYearStr)))
    .all();

  const memberMap = new Map<number, AnnualMemberRow>();
  for (const m of allMembers) {
    memberMap.set(m.id, {
      memberId: m.id,
      memberNo: m.memberNo,
      fullName: `${m.firstName} ${m.lastName}`,
      months: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
      totalCents: 0,
    });
  }

  const monthTotals: Record<number, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
  };
  let grandTotalCents = 0;
  const typeMap = new Map<number, number>();

  for (const row of rows) {
    let month = 1;
    if (row.period && row.period.includes('-')) {
      month = parseInt(row.period.split('-')[1] || '', 10) || 1;
    } else if (row.paidAt) {
      month = new Date(row.paidAt).getMonth() + 1;
    }

    if (month >= 1 && month <= 12) {
      let mRow = memberMap.get(row.memberId);
      if (!mRow) {
        const fb = allMembers.find((m) => m.id === row.memberId);
        mRow = {
          memberId: row.memberId,
          memberNo: fb ? fb.memberNo : `M-${row.memberId}`,
          fullName: fb ? `${fb.firstName} ${fb.lastName}` : 'Unknown Member',
          months: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
          totalCents: 0,
        };
        memberMap.set(row.memberId, mRow);
      }

      mRow.months[month] = (mRow.months[month] || 0) + row.amountCents;
      mRow.totalCents += row.amountCents;

      monthTotals[month] = (monthTotals[month] || 0) + row.amountCents;
      grandTotalCents += row.amountCents;

      typeMap.set(row.typeId, (typeMap.get(row.typeId) || 0) + row.amountCents);
    }
  }

  const typeBreakdown = allTypes.map((t) => ({
    typeId: t.id,
    typeName: t.name,
    kind: t.kind,
    totalCents: typeMap.get(t.id) || 0,
  }));

  return {
    year,
    members: Array.from(memberMap.values()),
    monthTotals,
    grandTotalCents,
    typeBreakdown,
  };
}
