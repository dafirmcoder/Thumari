import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { coffeeProduce, members, users, factoryRates, type CoffeeProduce, type NewCoffeeProduce, type FactoryRate, type NewFactoryRate } from '../db/schema.js';

export interface CoffeeProduceFilters {
  memberId?: number;
  status?: 'pending_verification' | 'verified' | 'rejected';
  year?: number;
  limit?: number;
  offset?: number;
}

export interface CoffeeProduceRecordWithRelations {
  produce: CoffeeProduce;
  member: typeof members.$inferSelect;
  recorder: typeof users.$inferSelect | null;
  verifier: typeof users.$inferSelect | null;
}

export interface CoffeeProduceSummary {
  totalDeliveries: number;
  totalNetKg: number;
  pendingDeliveries: number;
  verifiedDeliveries: number;
  estimatedGrossCents: number;
  estimatedNetCents: number;
}

export async function createProduceRecord(
  db: Db,
  data: Omit<NewCoffeeProduce, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<CoffeeProduce> {
  const [record] = await db
    .insert(coffeeProduce)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!record) {
    throw new Error('Failed to create coffee produce record');
  }
  return record;
}

export async function listProduceRecords(
  db: Db,
  filters: CoffeeProduceFilters = {},
): Promise<CoffeeProduceRecordWithRelations[]> {
  const conditions = [];

  if (filters.memberId) {
    conditions.push(eq(coffeeProduce.memberId, filters.memberId));
  }
  if (filters.status) {
    conditions.push(eq(coffeeProduce.status, filters.status));
  }
  if (filters.year) {
    const startOfYear = new Date(filters.year, 0, 1).getTime();
    const endOfYear = new Date(filters.year, 11, 31, 23, 59, 59).getTime();
    conditions.push(and(gte(coffeeProduce.receiptDate, new Date(startOfYear)), lte(coffeeProduce.receiptDate, new Date(endOfYear))));
  }

  const query = db
    .select({
      produce: coffeeProduce,
      member: members,
    })
    .from(coffeeProduce)
    .innerJoin(members, eq(coffeeProduce.memberId, members.id))
    .orderBy(desc(coffeeProduce.receiptDate), desc(coffeeProduce.id));

  if (conditions.length) {
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
    produce: r.produce,
    member: r.member,
    recorder: null,
    verifier: null,
  }));
}

export async function getProduceById(
  db: Db,
  id: number,
): Promise<CoffeeProduceRecordWithRelations | null> {
  const row = await db
    .select({
      produce: coffeeProduce,
      member: members,
    })
    .from(coffeeProduce)
    .innerJoin(members, eq(coffeeProduce.memberId, members.id))
    .where(eq(coffeeProduce.id, id))
    .get();

  if (!row) return null;

  return {
    produce: row.produce,
    member: row.member,
    recorder: null,
    verifier: null,
  };
}

export async function updateProduceStatus(
  db: Db,
  id: number,
  verifierUserId: number,
  status: 'verified' | 'rejected',
  rejectionReason?: string,
): Promise<CoffeeProduce | null> {
  const now = new Date();
  const [updated] = await db
    .update(coffeeProduce)
    .set({
      status,
      verifiedByUserId: verifierUserId,
      verifiedAt: now,
      rejectionReason: status === 'rejected' ? (rejectionReason || 'Rejected by treasurer/admin') : null,
      updatedAt: now,
    })
    .where(eq(coffeeProduce.id, id))
    .returning();

  return updated ?? null;
}

export async function getCoffeeProduceSummary(db: Db, memberId?: number): Promise<CoffeeProduceSummary> {
  const conditions = [];
  if (memberId) {
    conditions.push(eq(coffeeProduce.memberId, memberId));
  }

  const res = await db
    .select({
      totalDeliveries: sql<number>`count(*)`,
      totalNetKg: sql<number>`sum(${coffeeProduce.netKg})`,
      pendingDeliveries: sql<number>`sum(case when ${coffeeProduce.status} = 'pending_verification' then 1 else 0 end)`,
      verifiedDeliveries: sql<number>`sum(case when ${coffeeProduce.status} = 'verified' then 1 else 0 end)`,
      estimatedGrossCents: sql<number>`sum(${coffeeProduce.grossAmountCents})`,
      estimatedNetCents: sql<number>`sum(${coffeeProduce.netPayoutCents})`,
    })
    .from(coffeeProduce)
    .where(conditions.length ? and(...conditions) : undefined)
    .get();

  return {
    totalDeliveries: Number(res?.totalDeliveries || 0),
    totalNetKg: Number(res?.totalNetKg || 0),
    pendingDeliveries: Number(res?.pendingDeliveries || 0),
    verifiedDeliveries: Number(res?.verifiedDeliveries || 0),
    estimatedGrossCents: Number(res?.estimatedGrossCents || 0),
    estimatedNetCents: Number(res?.estimatedNetCents || 0),
  };
}

export async function getMemberProduceBreakdown(db: Db, year?: number) {
  const currentYear = year || new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1).getTime();
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).getTime();

  return await db
    .select({
      memberId: members.id,
      memberNo: members.memberNo,
      firstName: members.firstName,
      lastName: members.lastName,
      deliveryCount: sql<number>`count(${coffeeProduce.id})`,
      totalKg: sql<number>`sum(coalesce(${coffeeProduce.netKg}, 0))`,
      verifiedKg: sql<number>`sum(case when ${coffeeProduce.status} = 'verified' then ${coffeeProduce.netKg} else 0 end)`,
      grossAmountCents: sql<number>`sum(coalesce(${coffeeProduce.grossAmountCents}, 0))`,
    })
    .from(members)
    .leftJoin(
      coffeeProduce,
      and(
        eq(coffeeProduce.memberId, members.id),
        gte(coffeeProduce.receiptDate, new Date(startOfYear)),
        lte(coffeeProduce.receiptDate, new Date(endOfYear)),
      ),
    )
    .groupBy(members.id)
    .orderBy(desc(sql`sum(coalesce(${coffeeProduce.netKg}, 0))`))
    .all();
}

// ----------------- FACTORY RATES MANAGEMENT -----------------

export async function listFactoryRates(db: Db, year?: number): Promise<FactoryRate[]> {
  const conditions = [];
  if (year) {
    conditions.push(eq(factoryRates.seasonYear, year));
  }
  return await db
    .select()
    .from(factoryRates)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(factoryRates.seasonYear), factoryRates.factoryName, factoryRates.grade)
    .all();
}

export async function upsertFactoryRate(
  db: Db,
  input: {
    factoryName: string;
    societyName?: string;
    seasonYear: number;
    grade: string;
    ratePerKgCents: number;
    notes?: string;
    updatedBy?: number;
  },
): Promise<FactoryRate> {
  const now = new Date();
  const existing = await db
    .select()
    .from(factoryRates)
    .where(
      and(
        eq(factoryRates.factoryName, input.factoryName.trim()),
        eq(factoryRates.seasonYear, input.seasonYear),
        eq(factoryRates.grade, input.grade.trim()),
      ),
    )
    .get();

  if (existing) {
    const [updated] = await db
      .update(factoryRates)
      .set({
        societyName: input.societyName?.trim() || existing.societyName,
        ratePerKgCents: input.ratePerKgCents,
        notes: input.notes !== undefined ? input.notes.trim() || null : existing.notes,
        updatedBy: input.updatedBy || existing.updatedBy,
        updatedAt: now,
      })
      .where(eq(factoryRates.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(factoryRates)
    .values({
      factoryName: input.factoryName.trim(),
      societyName: input.societyName?.trim() || null,
      seasonYear: input.seasonYear,
      grade: input.grade.trim(),
      ratePerKgCents: input.ratePerKgCents,
      notes: input.notes?.trim() || null,
      updatedBy: input.updatedBy || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created!;
}

export async function getApplicableFactoryRate(
  db: Db,
  factoryName: string,
  grade: string,
  year?: number,
): Promise<number | null> {
  const seasonYear = year || new Date().getFullYear();
  const trimmedFactory = factoryName.trim();
  const trimmedGrade = grade.trim();

  // 1. Match exact factory, year, and grade
  const exact = await db
    .select({ rate: factoryRates.ratePerKgCents })
    .from(factoryRates)
    .where(
      and(
        eq(factoryRates.factoryName, trimmedFactory),
        eq(factoryRates.seasonYear, seasonYear),
        eq(factoryRates.grade, trimmedGrade),
      ),
    )
    .get();

  if (exact) return exact.rate;

  // 2. Match exact factory and grade from most recent year
  const fallbackGrade = await db
    .select({ rate: factoryRates.ratePerKgCents })
    .from(factoryRates)
    .where(
      and(
        eq(factoryRates.factoryName, trimmedFactory),
        eq(factoryRates.grade, trimmedGrade),
      ),
    )
    .orderBy(desc(factoryRates.seasonYear))
    .limit(1)
    .get();

  if (fallbackGrade) return fallbackGrade.rate;

  // 3. Match any rate for this factory
  const fallbackFactory = await db
    .select({ rate: factoryRates.ratePerKgCents })
    .from(factoryRates)
    .where(eq(factoryRates.factoryName, trimmedFactory))
    .orderBy(desc(factoryRates.seasonYear))
    .limit(1)
    .get();

  return fallbackFactory ? fallbackFactory.rate : null;
}

export async function deleteFactoryRate(db: Db, id: number): Promise<boolean> {
  const res = await db.delete(factoryRates).where(eq(factoryRates.id, id)).returning();
  return res.length > 0;
}
