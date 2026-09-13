import { eq } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { notifications } from '../../db/schema.js';
import { listUserPushSubscriptions, disablePushSubscription, incrementSubscriptionFailure } from './subscriptions.js';
import { sendWebPush } from './sender.js';

export interface PushJob {
  notificationId: number;
  userId: number;
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    data?: any;
  };
}

export class NotificationQueue {
  private queue: PushJob[] = [];
  private processing = false;

  constructor(private db: Db) {}

  enqueue(job: PushJob): void {
    this.queue.push(job);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const job = this.queue.shift()!;
    try {
      await this.deliverJob(job);
    } catch (err) {
      console.error('[NotificationQueue] Error delivering job:', err);
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  private async deliverJob(job: PushJob): Promise<void> {
    const subscriptions = await listUserPushSubscriptions(this.db, job.userId);
    if (subscriptions.length === 0) {
      await this.db.update(notifications)
        .set({ pushStatus: 'skipped' })
        .where(eq(notifications.id, job.notificationId));
      return;
    }

    const payloadString = JSON.stringify({
      title: job.payload.title,
      body: job.payload.body,
      url: job.payload.url ?? '/',
      tag: job.payload.tag,
      data: job.payload.data,
      notificationId: job.notificationId,
    });

    let sentCount = 0;
    let failedCount = 0;
    let lastError = '';

    for (const sub of subscriptions) {
      const outcome = await sendWebPush(sub, payloadString);
      if (outcome.ok) {
        sentCount++;
      } else {
        failedCount++;
        lastError = outcome.error || 'Failed';
        if (outcome.gone) {
          await disablePushSubscription(this.db, sub.endpoint);
        } else {
          await incrementSubscriptionFailure(this.db, sub.endpoint);
        }
      }
    }

    const finalStatus = sentCount > 0 ? 'sent' : failedCount > 0 ? 'failed' : 'skipped';
    await this.db.update(notifications)
      .set({
        pushStatus: finalStatus,
        pushedAt: new Date(),
        pushError: lastError || null,
      })
      .where(eq(notifications.id, job.notificationId));
  }
}
