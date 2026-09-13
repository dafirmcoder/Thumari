import { eq, and, sql, lte } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { members, contributions, contributionTypes, type Member } from '../db/schema.js';

export interface DividendCalculationOptions {
  totalProfitPoolCents: number; // Total net earnings available
  retainedEarningsPercent?: number; // e.g., 10% kept in group reserve
  withholdingTaxPercent?: number; // e.g., 5% or 0%
  year?: number;
  distributionBasis?: 'contributions' | 'equal';
}

export interface MemberDividendAllocation {
  memberId: number;
  memberNo: string;
  fullName: string;
  phone: string | null;
  status: string;
  cumulativeContributionsCents: number;
  contributionSharePercent: number;
  grossDividendCents: number;
  withholdingTaxCents: number;
  netDividendPayableCents: number;
}

export interface DividendCalculationResult {
  year: number;
  totalProfitPoolCents: number;
  retainedEarningsPercent: number;
  retainedReservesCents: number;
  distributableDividendCents: number;
  withholdingTaxPercent: number;
  totalWithholdingTaxCents: number;
  totalNetPayableCents: number;
  distributionBasis: 'contributions' | 'equal';
  totalQualifyingContributionsCents: number;
  memberAllocations: MemberDividendAllocation[];
}

export async function calculateDividends(
  db: Db,
  options: DividendCalculationOptions,
): Promise<DividendCalculationResult> {
  const currentYear = options.year || new Date().getFullYear();
  const retainedPct = Math.max(0, Math.min(100, options.retainedEarningsPercent ?? 10));
  const whtPct = Math.max(0, Math.min(100, options.withholdingTaxPercent ?? 5));
  const basis = options.distributionBasis || 'contributions';

  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

  // 1. Fetch active members
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, 'active'))
    .orderBy(members.memberNo)
    .all();

  // 2. Fetch member cumulative contributions (savings & shares) up to year end
  const contribRows = await db
    .select({
      memberId: contributions.memberId,
      totalCents: sql<number>`sum(${contributions.amountCents})`,
    })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(
      and(
        lte(contributions.paidAt, endOfYear),
        // Include savings and investment shares as dividend-earning capital
        sql`${contributionTypes.kind} IN ('savings', 'shares')`,
      ),
    )
    .groupBy(contributions.memberId)
    .all();

  const contribMap = new Map<number, number>();
  for (const r of contribRows) {
    contribMap.set(r.memberId, Number(r.totalCents || 0));
  }

  // 3. Compute pool splits
  const totalProfitPoolCents = Math.max(0, options.totalProfitPoolCents);
  const retainedReservesCents = Math.round((totalProfitPoolCents * retainedPct) / 100);
  const distributableDividendCents = Math.max(0, totalProfitPoolCents - retainedReservesCents);

  // Total qualifying contributions
  let totalQualifyingContributionsCents = 0;
  for (const m of allMembers) {
    totalQualifyingContributionsCents += contribMap.get(m.id) || 0;
  }

  const memberAllocations: MemberDividendAllocation[] = [];
  let totalWithholdingTaxCents = 0;
  let totalNetPayableCents = 0;

  for (const m of allMembers) {
    const memberContrib = contribMap.get(m.id) || 0;
    let sharePercent = 0;
    let grossDividendCents = 0;

    if (basis === 'equal') {
      sharePercent = allMembers.length > 0 ? 100 / allMembers.length : 0;
      grossDividendCents = allMembers.length > 0 ? Math.round(distributableDividendCents / allMembers.length) : 0;
    } else {
      // Pro-rata based on member contributions
      sharePercent = totalQualifyingContributionsCents > 0
        ? (memberContrib / totalQualifyingContributionsCents) * 100
        : (allMembers.length > 0 ? 100 / allMembers.length : 0);
      grossDividendCents = totalQualifyingContributionsCents > 0
        ? Math.round((memberContrib / totalQualifyingContributionsCents) * distributableDividendCents)
        : 0;
    }

    const withholdingTaxCents = Math.round((grossDividendCents * whtPct) / 100);
    const netDividendPayableCents = Math.max(0, grossDividendCents - withholdingTaxCents);

    totalWithholdingTaxCents += withholdingTaxCents;
    totalNetPayableCents += netDividendPayableCents;

    memberAllocations.push({
      memberId: m.id,
      memberNo: m.memberNo,
      fullName: `${m.firstName} ${m.lastName}`,
      phone: m.phone,
      status: m.status,
      cumulativeContributionsCents: memberContrib,
      contributionSharePercent: sharePercent,
      grossDividendCents,
      withholdingTaxCents,
      netDividendPayableCents,
    });
  }

  // Sort by highest contribution / dividend
  memberAllocations.sort((a, b) => b.grossDividendCents - a.grossDividendCents);

  return {
    year: currentYear,
    totalProfitPoolCents,
    retainedEarningsPercent: retainedPct,
    retainedReservesCents,
    distributableDividendCents,
    withholdingTaxPercent: whtPct,
    totalWithholdingTaxCents,
    totalNetPayableCents,
    distributionBasis: basis,
    totalQualifyingContributionsCents,
    memberAllocations,
  };
}
