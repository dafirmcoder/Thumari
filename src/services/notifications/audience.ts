import { eq, inArray, and } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { users } from '../../db/schema.js';

export async function resolveAudienceUserIds(
  db: Db,
  audience: 'member' | 'officers' | 'admins' | 'all',
  context: { memberId?: number | null; explicitUserIds?: number[] } = {},
): Promise<number[]> {
  if (context.explicitUserIds && context.explicitUserIds.length > 0) {
    return context.explicitUserIds;
  }

  if (audience === 'member') {
    if (!context.memberId) return [];
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.memberId, context.memberId), eq(users.status, 'active')))
      .get();
    return user ? [user.id] : [];
  }

  if (audience === 'admins') {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active')))
      .all();
    return rows.map((r: { id: number }) => r.id);
  }

  if (audience === 'officers') {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.role, ['admin', 'treasurer', 'secretary']),
          eq(users.status, 'active'),
        ),
      )
      .all();
    return rows.map((r: { id: number }) => r.id);
  }

  if (audience === 'all') {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.status, 'active'))
      .all();
    return rows.map((r: { id: number }) => r.id);
  }

  return [];
}
