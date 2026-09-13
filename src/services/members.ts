import { desc, sql, and, like, or, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { members, contributions, contributionTypes, type Member, MEMBER_STATUSES } from '../db/schema.js';

export const memberInputSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  nationalId: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  joinDate: z.date().optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  notes: z.string().trim().optional(),
});

export type MemberInput = z.infer<typeof memberInputSchema>;

export async function generateNextMemberNo(db: Db): Promise<string> {
  const last = await db
    .select({ memberNo: members.memberNo })
    .from(members)
    .orderBy(desc(members.id))
    .limit(1)
    .get();

  if (!last) return 'M-0001';

  const match = /^M-(\d+)$/.exec(last.memberNo);
  if (!match) return `M-${Date.now().toString().slice(-4)}`;

  const nextNum = parseInt(match[1]!, 10) + 1;
  return `M-${nextNum.toString().padStart(4, '0')}`;
}

export async function createMember(db: Db, input: MemberInput): Promise<Member> {
  const memberNo = await generateNextMemberNo(db);
  const now = new Date();

  await db.insert(members).values({
    memberNo,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone || null,
    email: input.email || null,
    nationalId: input.nationalId || null,
    photoUrl: input.photoUrl || null,
    joinDate: input.joinDate ?? now,
    status: input.status ?? 'active',
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db.select().from(members).where(eq(members.memberNo, memberNo)).get();
  return created!;
}

export async function updateMember(db: Db, id: number, input: Partial<MemberInput>): Promise<Member | null> {
  const existing = await db.select().from(members).where(eq(members.id, id)).get();
  if (!existing) return null;

  await db.update(members)
    .set({
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      phone: input.phone !== undefined ? (input.phone || null) : existing.phone,
      email: input.email !== undefined ? (input.email || null) : existing.email,
      nationalId: input.nationalId !== undefined ? (input.nationalId || null) : existing.nationalId,
      photoUrl: input.photoUrl !== undefined ? (input.photoUrl || null) : existing.photoUrl,
      joinDate: input.joinDate ?? existing.joinDate,
      status: input.status ?? existing.status,
      notes: input.notes !== undefined ? (input.notes || null) : existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(members.id, id));

  return (await db.select().from(members).where(eq(members.id, id)).get()) ?? null;
}

export async function getMemberById(db: Db, id: number): Promise<Member | null> {
  return (await db.select().from(members).where(eq(members.id, id)).get()) ?? null;
}

export async function listMembers(
  db: Db,
  options: { search?: string; status?: string } = {},
): Promise<Array<Member & { totalSavingsCents: number }>> {
  const conditions = [];
  if (options.status && options.status !== 'all') {
    conditions.push(eq(members.status, options.status as any));
  }
  if (options.search) {
    const pattern = `%${options.search.trim()}%`;
    conditions.push(
      or(
        like(members.firstName, pattern),
        like(members.lastName, pattern),
        like(members.memberNo, pattern),
        like(members.phone, pattern),
        like(members.nationalId, pattern),
      ),
    );
  }

  const memberRows = conditions.length > 0
    ? await db.select().from(members).where(and(...conditions)).orderBy(members.memberNo).all()
    : await db.select().from(members).orderBy(members.memberNo).all();

  // Calculate savings for each member
  const savingsMap = new Map<number, number>();
  const savingsRows = await db
    .select({
      memberId: contributions.memberId,
      total: sql<number>`sum(${contributions.amountCents})`,
    })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(eq(contributionTypes.kind, 'savings'))
    .groupBy(contributions.memberId)
    .all();

  for (const r of savingsRows) {
    savingsMap.set(r.memberId, Number(r.total || 0));
  }

  return memberRows.map((m: Member) => ({
    ...m,
    totalSavingsCents: savingsMap.get(m.id) ?? 0,
  }));
}

export async function getMemberSavingsCents(db: Db, memberId: number): Promise<number> {
  const result = await db
    .select({ total: sql<number>`sum(${contributions.amountCents})` })
    .from(contributions)
    .innerJoin(contributionTypes, eq(contributions.typeId, contributionTypes.id))
    .where(and(eq(contributions.memberId, memberId), eq(contributionTypes.kind, 'savings')))
    .get();

  return Number(result?.total || 0);
}
