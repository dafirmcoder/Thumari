import { eq, and, isNull, desc, count } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { notifications, type NotificationRow } from '../../db/schema.js';

export async function listUserNotifications(
  db: Db,
  userId: number,
  limit = 50,
): Promise<NotificationRow[]> {
  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
}

export async function getUnreadNotificationCount(db: Db, userId: number): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .get();

  return result?.value ?? 0;
}

export async function markNotificationAsRead(db: Db, notificationId: number, userId: number): Promise<void> {
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsAsRead(db: Db, userId: number): Promise<void> {
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
