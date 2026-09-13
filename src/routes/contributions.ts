import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import type { NotificationQueue } from '../services/notifications/queue.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  listContributions,
  listContributionTypes,
  recordContribution,
  getContributionReceipt,
} from '../services/contributions.js';
import { listMembers } from '../services/members.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { fromDateInputValue } from '../lib/dates.js';
import { parseMoneyToCents, formatMoney } from '../lib/money.js';
import { dispatchNotification } from '../services/notifications/dispatch.js';

export function registerContributionRoutes(
  app: FastifyInstance,
  db: Db,
  config: AppConfig,
  queue: NotificationQueue | null,
) {
  // Contributions List
  app.get('/contributions', { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as any;
    const records = await listContributions(db, {
      memberId: q.memberId ? parseInt(q.memberId, 10) : undefined,
      typeId: q.typeId ? parseInt(q.typeId, 10) : undefined,
      period: q.period,
    });
    const types = await listContributionTypes(db, false);
    return await renderView(request, reply, 'contributions/list.ejs', { contributions: records, types, filter: q }, config, db);
  });

  // Record Contribution Page
  app.get('/contributions/new', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const membersList = await listMembers(db, { status: 'active' });
    const types = await listContributionTypes(db, true);
    return await renderView(request, reply, 'contributions/form.ejs', { members: membersList, types }, config, db);
  });

  // Record Contribution POST
  app.post('/contributions', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const body = request.body as any;
    const memberId = parseInt(body.memberId, 10);
    const typeId = parseInt(body.typeId, 10);
    const amountCents = parseMoneyToCents(body.amount);
    const paidAt = body.paidAt ? fromDateInputValue(body.paidAt, config.org.timezone) : new Date();

    if (!memberId || !typeId || !amountCents || amountCents <= 0) {
      setFlash(reply, 'error', 'Please enter a valid member, type, and positive amount.');
      return reply.redirect('/contributions/new');
    }

    try {
      const record = await recordContribution(
        db,
        {
          memberId,
          typeId,
          amountCents,
          paidAt: paidAt ?? new Date(),
          period: body.period || undefined,
          method: body.method || 'cash',
          reference: body.reference || undefined,
          notes: body.notes || undefined,
          recordedBy: request.currentUser?.id,
        },
        config.org.timezone,
      );

      // Trigger Notification
      await dispatchNotification(db, queue, {
        eventKey: 'contribution.recorded',
        title: 'Contribution Received',
        body: `Your payment of ${formatMoney(amountCents, { symbol: config.org.currencySymbol })} for ${record.type.name} was recorded successfully.`,
        url: `/contributions/${record.id}/receipt`,
        memberId: record.memberId,
      });

      setFlash(reply, 'success', 'Contribution recorded successfully.');
      return reply.redirect(`/contributions/${record.id}/receipt`);
    } catch (err: any) {
      setFlash(reply, 'error', err.message || 'Failed to record contribution.');
      return reply.redirect('/contributions/new');
    }
  });

  // Contribution Receipt View
  app.get('/contributions/:id/receipt', { preHandler: requireAuth }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const receipt = await getContributionReceipt(db, id);
    if (!receipt) {
      setFlash(reply, 'error', 'Receipt not found.');
      return reply.redirect('/contributions');
    }
    return await renderView(request, reply, 'contributions/receipt.ejs', { receipt }, config, db);
  });
}
