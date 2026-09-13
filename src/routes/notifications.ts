import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import type { NotificationQueue } from '../services/notifications/queue.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  listUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notifications/inbox.js';
import {
  getEffectivePreferences,
  updateUserPreferences,
} from '../services/notifications/preferences.js';
import {
  savePushSubscription,
  listUserPushSubscriptions,
} from '../services/notifications/subscriptions.js';
import { dispatchNotification } from '../services/notifications/dispatch.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';

export function registerNotificationRoutes(
  app: FastifyInstance,
  db: Db,
  config: AppConfig,
  queue: NotificationQueue | null,
) {
  // Inbox Page
  app.get('/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const userNotifications = await listUserNotifications(db, request.currentUser!.id);
    const preferences = await getEffectivePreferences(db, request.currentUser!.id);
    const subscriptions = await listUserPushSubscriptions(db, request.currentUser!.id);

    return await renderView(
      request,
      reply,
      'notifications/index.ejs',
      {
        notifications: userNotifications,
        preferences,
        subscriptions,
        vapidPublicKey: config.vapid.publicKey,
      },
      config,
      db,
    );
  });

  // Mark all as read
  app.post('/notifications/read-all', { preHandler: requireAuth }, async (request, reply) => {
    await markAllNotificationsAsRead(db, request.currentUser!.id);
    setFlash(reply, 'info', 'All notifications marked as read.');
    return reply.redirect('/notifications');
  });

  // Mark single as read
  app.post('/notifications/:id/read', { preHandler: requireAuth }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    await markNotificationAsRead(db, id, request.currentUser!.id);
    return reply.redirect('/notifications');
  });

  // Update Preferences
  app.post('/notifications/preferences', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as Record<string, any>;
    const updates: Record<string, boolean> = {};

    for (const key of Object.keys(body)) {
      if (key !== '_csrf') {
        updates[key] = body[key] === 'on' || body[key] === 'true';
      }
    }

    await updateUserPreferences(db, request.currentUser!.id, updates);
    setFlash(reply, 'success', 'Notification preferences updated.');
    return reply.redirect('/notifications');
  });

  // API: Subscribe Push
  app.post('/api/push/subscribe', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as any;
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return reply.status(400).send({ error: 'Invalid push subscription payload' });
    }

    const sub = await savePushSubscription(db, request.currentUser!.id, {
      endpoint: body.endpoint,
      keys: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      userAgent: request.headers['user-agent'],
    });

    return reply.send({ success: true, id: sub.id });
  });

  // API: Test Push Notification
  app.post('/api/push/test', { preHandler: requireAuth }, async (request, reply) => {
    await dispatchNotification(db, queue, {
      eventKey: 'system.announcement',
      title: 'Thumari Push Notification Test',
      body: 'This is a test notification from Thumari SACCO! Both PWA and Android APK push channels are active.',
      url: '/notifications',
      explicitUserIds: [request.currentUser!.id],
    });

    return reply.send({ success: true, message: 'Test notification queued' });
  });

  // Admin Broadcast Composer
  app.get('/notifications/broadcast', { preHandler: [requireAuth, requireRole(['admin'])] }, async (request, reply) => {
    return await renderView(request, reply, 'notifications/broadcast.ejs', {}, config, db);
  });

  // Admin Broadcast POST
  app.post('/notifications/broadcast', { preHandler: [requireAuth, requireRole(['admin'])] }, async (request, reply) => {
    const body = request.body as any;
    if (!body.title || !body.body) {
      setFlash(reply, 'error', 'Title and message are required.');
      return reply.redirect('/notifications/broadcast');
    }

    const res = await dispatchNotification(db, queue, {
      eventKey: 'system.announcement',
      title: body.title,
      body: body.body,
      url: body.url || '/notifications',
    });

    setFlash(reply, 'success', `Broadcast announcement delivered to ${res.recipientCount} active members.`);
    return reply.redirect('/notifications');
  });
}
