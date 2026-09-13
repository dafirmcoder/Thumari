import { sql, eq, and } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  members,
  contributions,
  contributionTypes,
  loans,
  loanSchedule,
  meetings,
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

  return {
    activeMemberCount,
    totalSavingsCents,
    thisMonthSavingsCents,
    activeLoanCount,
    totalOutstandingLoanCents,
    overdueInstallmentCents: Math.max(0, overdueInstallmentCents),
    upcomingMeeting,
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
