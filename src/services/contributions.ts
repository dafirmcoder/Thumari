import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  contributions,
  contributionTypes,
  members,
  users,
  type Contribution,
  type ContributionType,
  PAYMENT_METHODS,
} from '../db/schema.js';
import { periodKey } from '../lib/dates.js';

export const recordContributionSchema = z.object({
  memberId: z.coerce.number().int().positive(),
  typeId: z.coerce.number().int().positive(),
  amountCents: z.coerce.number().int().positive('Amount must be greater than zero'),
  paidAt: z.date(),
  period: z.string().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  recordedBy: z.number().optional(),
});

export type RecordContributionInput = z.infer<typeof recordContributionSchema>;

export async function listContributionTypes(db: Db, activeOnly = true): Promise<ContributionType[]> {
  if (activeOnly) {
    return await db.select().from(contributionTypes).where(eq(contributionTypes.active, true)).all();
  }
  return await db.select().from(contributionTypes).all();
}

export async function recordContribution(
  db: Db,
  input: RecordContributionInput,
  timezone: string,
): Promise<Contribution & { member: typeof members.$inferSelect; type: ContributionType }> {
  const period = input.period || periodKey(input.paidAt, timezone);

  const inserted = await db
    .insert(contributions)
    .values({
      memberId: input.memberId,
      typeId: input.typeId,
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      period,
      method: input.method ?? 'cash',
      reference: input.reference || null,
      notes: input.notes || null,
      recordedBy: input.recordedBy || null,
    })
    .returning({ id: contributions.id })
    .get();

  const record = await db
    .select({
      contribution: contributions,
      member: members,
      type: contributionTypes,
    })
    .from(contributions)
    .innerJoin(members, eq(contributions.memberId, members.id))
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(eq(contributions.id, inserted.id))
    .get();

  return {
    ...record!.contribution,
    member: record!.member,
    type: record!.type,
  };
}

export async function listContributions(
  db: Db,
  options: { memberId?: number; typeId?: number; period?: string; limit?: number } = {},
): Promise<Array<Contribution & { memberName: string; memberNo: string; typeName: string; recordedByName?: string }>> {
  const conditions = [];
  if (options.memberId) conditions.push(eq(contributions.memberId, options.memberId));
  if (options.typeId) conditions.push(eq(contributions.typeId, options.typeId));
  if (options.period) conditions.push(eq(contributions.period, options.period));

  const query = db
    .select({
      contribution: contributions,
      memberFirstName: members.firstName,
      memberLastName: members.lastName,
      memberNo: members.memberNo,
      typeName: contributionTypes.name,
      recordedByName: users.name,
    })
    .from(contributions)
    .innerJoin(members, eq(contributions.memberId, members.id))
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .leftJoin(users, eq(contributions.recordedBy, users.id))
    .orderBy(desc(contributions.paidAt));

  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).limit(options.limit ?? 100).all()
    : await query.limit(options.limit ?? 100).all();

  return rows.map((r: any) => ({
    ...r.contribution,
    memberName: `${r.memberFirstName} ${r.memberLastName}`,
    memberNo: r.memberNo,
    typeName: r.typeName,
    recordedByName: r.recordedByName || undefined,
  }));
}

export async function getContributionReceipt(db: Db, id: number) {
  return await db
    .select({
      contribution: contributions,
      member: members,
      type: contributionTypes,
      recordedByName: users.name,
    })
    .from(contributions)
    .innerJoin(members, eq(contributions.memberId, members.id))
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .leftJoin(users, eq(contributions.recordedBy, users.id))
    .where(eq(contributions.id, id))
    .get();
}
