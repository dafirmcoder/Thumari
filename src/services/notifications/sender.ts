import webpush from 'web-push';
import type { AppConfig } from '../../config.js';
import type { PushSubscriptionRow } from '../../db/schema.js';

export interface PushSendResult {
  ok: boolean;
  statusCode?: number;
  gone?: boolean;
  error?: string;
}

let configured = false;

export function configureWebPush(config: AppConfig): boolean {
  if (!config.vapid.publicKey || !config.vapid.privateKey) {
    return false;
  }
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );
  configured = true;
  return true;
}

export async function sendWebPush(
  sub: PushSubscriptionRow,
  payload: string,
): Promise<PushSendResult> {
  if (!configured) {
    return { ok: false, error: 'VAPID keys not configured' };
  }

  const pushSubscription: webpush.PushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  try {
    const res = await webpush.sendNotification(pushSubscription, payload, {
      TTL: 86400, // 1 day
    });
    return { ok: true, statusCode: res.statusCode };
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    const gone = statusCode === 404 || statusCode === 410;
    return {
      ok: false,
      statusCode,
      gone,
      error: err.message || 'Push delivery failed',
    };
  }
}
