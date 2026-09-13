import type { Db } from '../../db/index.js';
import { notifications } from '../../db/schema.js';
import { getEventSpec } from './events.js';
import { isEventEnabledForUser } from './preferences.js';
import { resolveAudienceUserIds } from './audience.js';
import type { NotificationQueue } from './queue.js';

export interface DispatchNotificationInput {
  eventKey: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  memberId?: number | null;
  explicitUserIds?: number[];
  silent?: boolean;
}

export interface DispatchResult {
  eventKey: string;
  recipientCount: number;
  notificationIds: number[];
}

export async function dispatchNotification(
  db: Db,
  queue: NotificationQueue | null,
  input: DispatchNotificationInput,
): Promise<DispatchResult> {
  const spec = getEventSpec(input.eventKey);
  const audience = spec ? spec.defaultAudience : 'all';

  const userIds = await resolveAudienceUserIds(db, audience, {
    memberId: input.memberId,
    explicitUserIds: input.explicitUserIds,
  });

  const notificationIds: number[] = [];

  for (const userId of userIds) {
    if (!(await isEventEnabledForUser(db, userId, input.eventKey))) {
      continue;
    }

    const inserted = await db
      .insert(notifications)
      .values({
        userId,
        eventKey: input.eventKey,
        title: input.title,
        body: input.body,
        url: input.url,
        data: input.data ? JSON.stringify(input.data) : null,
        pushStatus: 'pending',
      })
      .returning({ id: notifications.id })
      .get();

    if (inserted) {
      notificationIds.push(inserted.id);

      if (!input.silent && queue) {
        queue.enqueue({
          notificationId: inserted.id,
          userId,
          payload: {
            title: input.title,
            body: input.body,
            url: input.url,
            tag: input.eventKey,
            data: input.data,
          },
        });
      }
    }
  }

  return {
    eventKey: input.eventKey,
    recipientCount: notificationIds.length,
    notificationIds,
  };
}
