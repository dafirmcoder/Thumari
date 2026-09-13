import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { pushSubscriptions, type PushSubscriptionRow } from '../../db/schema.js';

export interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface SaveSubscriptionInput {
  endpoint: string;
  keys: SubscriptionKeys;
  userAgent?: string;
  platform?: string;
}

export async function savePushSubscription(
  db: Db,
  userId: number,
  input: SaveSubscriptionInput,
): Promise<PushSubscriptionRow> {
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint))
    .get();

  if (existing) {
    await db.update(pushSubscriptions)
      .set({
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? existing.userAgent,
        platform: input.platform ?? existing.platform,
        disabledAt: null,
        failureCount: 0,
        lastSeenAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing.id));

    const updated = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, existing.id)).get();
    return updated!;
  }

  await db.insert(pushSubscriptions)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
      platform: input.platform,
      lastSeenAt: new Date(),
    });

  const created = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint)).get();
  return created!;
}

export async function listUserPushSubscriptions(db: Db, userId: number): Promise<PushSubscriptionRow[]> {
  return await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), isNull(pushSubscriptions.disabledAt)))
    .all();
}

export async function disablePushSubscription(db: Db, endpoint: string): Promise<void> {
  await db.update(pushSubscriptions)
    .set({ disabledAt: new Date() })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function incrementSubscriptionFailure(db: Db, endpoint: string): Promise<void> {
  const sub = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).get();
  if (sub) {
    const newCount = sub.failureCount + 1;
    await db.update(pushSubscriptions)
      .set({
        failureCount: newCount,
        disabledAt: newCount >= 3 ? new Date() : sub.disabledAt,
      })
      .where(eq(pushSubscriptions.id, sub.id));
  }
}
