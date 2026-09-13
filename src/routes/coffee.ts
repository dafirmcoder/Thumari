import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  createProduceRecord,
  listProduceRecords,
  getProduceById,
  updateProduceStatus,
  getCoffeeProduceSummary,
  listFactoryRates,
  upsertFactoryRate,
  getApplicableFactoryRate,
  deleteFactoryRate,
} from '../services/coffee.js';
import { listMembers } from '../services/members.js';
import { performReceiptOcr, parseReceiptText } from '../lib/ocr-receipt.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { parseMoneyToCents } from '../lib/money.js';
import { RECEIPTS_DIR } from '../paths.js';
import type { NotificationQueue } from '../services/notifications/queue.js';
import { recordAudit } from '../services/audit.js';

export function registerCoffeeRoutes(
  app: FastifyInstance,
  db: Db,
  config: AppConfig,
  queue?: NotificationQueue,
) {
  // Ensure receipts upload directory exists
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

  // 1. List Produce Records
  app.get('/coffee', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const query = request.query as {
      status?: 'pending_verification' | 'verified' | 'rejected';
      year?: string;
      memberId?: string;
    };

    const filterMemberId =
      user.role === 'member' && user.memberId
        ? user.memberId
        : query.memberId
        ? parseInt(query.memberId, 10)
        : undefined;

    const year = query.year ? parseInt(query.year, 10) : undefined;

    const records = await listProduceRecords(db, {
      status: query.status,
      memberId: filterMemberId,
      year,
    });

    const summary = await getCoffeeProduceSummary(db, filterMemberId);
    const membersList = await listMembers(db, { status: 'active' });

    return await renderView(
      request,
      reply,
      'coffee/list.ejs',
      {
        records,
        summary,
        membersList,
        selectedStatus: query.status || '',
        selectedMemberId: filterMemberId || '',
        selectedYear: query.year || '',
      },
      config,
      db,
    );
  });

  // 2. Receipt Scanner / Camera Photo Capture Page
  app.get('/coffee/scan', { preHandler: [requireAuth] }, async (request, reply) => {
    const membersList = await listMembers(db, { status: 'active' });
    const user = request.currentUser!;

    return await renderView(
      request,
      reply,
      'coffee/scan.ejs',
      {
        membersList,
        currentUserMemberId: user.memberId || null,
        currentUserRole: user.role,
      },
      config,
      db,
    );
  });

  // 3. OCR API: Upload Photo and Extract Fields
  app.post('/coffee/ocr', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No image uploaded' });
      }

      const buffer = await data.toBuffer();
      const ext = path.extname(data.filename) || '.jpg';
      const filename = `receipt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const filePath = path.join(RECEIPTS_DIR, filename);

      await fs.promises.writeFile(filePath, buffer);

      const publicImagePath = `/static/uploads/receipts/${filename}`;

      // Retrieve all active members for fuzzy name matching
      const allMembers = await listMembers(db, { status: 'active' });

      // Run OCR & Regex matching
      const extracted = await performReceiptOcr(filePath, allMembers);

      return reply.send({
        success: true,
        data: extracted,
        imagePath: publicImagePath,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to process receipt image OCR',
      });
    }
  });

  // 4. Save Produce Record
  app.post('/coffee/save', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.currentUser!;
    const body = request.body as any;

    try {
      let memberId = parseInt(body.memberId, 10);
      if (user.role === 'member' && user.memberId) {
        memberId = user.memberId;
      }

      if (!memberId || isNaN(memberId)) {
        setFlash(reply, 'error', 'Please select a valid member.');
        return reply.redirect('/coffee/scan');
      }

      const netKg = parseFloat(body.netKg);
      if (isNaN(netKg) || netKg <= 0) {
        setFlash(reply, 'error', 'Please provide a valid Net Produce Weight in KGs.');
        return reply.redirect('/coffee/scan');
      }

      const grossKg = parseFloat(body.grossKg) || netKg;
      const tareKg = parseFloat(body.tareKg) || 0;
      const ratePerKgCents = parseMoneyToCents(body.ratePerKg) || 0;
      const grossAmountCents = parseMoneyToCents(body.grossAmount) || (ratePerKgCents > 0 ? Math.round(netKg * ratePerKgCents) : 0);
      const deductionsCents = parseMoneyToCents(body.deductions) || 0;
      const netPayoutCents = parseMoneyToCents(body.netPayout) || Math.max(0, grossAmountCents - deductionsCents);
      const receiptDate = body.receiptDate ? new Date(body.receiptDate) : new Date();

      const record = await createProduceRecord(db, {
        memberId,
        factoryGrowerNo: body.factoryGrowerNo?.trim() || null,
        extractedMemberName: body.extractedMemberName?.trim() || null,
        receiptNo: body.receiptNo?.trim() || null,
        receiptDate,
        factoryName: body.factoryName?.trim() || null,
        societyName: body.societyName?.trim() || null,
        grossKg,
        tareKg,
        netKg,
        ratePerKgCents,
        grossAmountCents,
        deductionsCents,
        netPayoutCents,
        receiptImagePath: body.receiptImagePath?.trim() || '/static/images/logo.png',
        ocrRawText: body.ocrRawText?.trim() || null,
        status: user.role === 'admin' || user.role === 'treasurer' ? 'verified' : 'pending_verification',
        recordedBy: user.id,
        verifiedByUserId: user.role === 'admin' || user.role === 'treasurer' ? user.id : null,
        verifiedAt: user.role === 'admin' || user.role === 'treasurer' ? new Date() : null,
        notes: body.notes?.trim() || null,
      });

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'create',
        entity: 'coffee_produce',
        entityId: record.id,
        detail: { memberId, netKg, receiptNo: body.receiptNo },
        ip: request.ip,
      });

      setFlash(reply, 'success', `Coffee produce delivery of ${netKg.toFixed(1)} KGs saved successfully.`);
      return reply.redirect(`/coffee/${record.id}`);
    } catch (err: any) {
      request.log.error(err);
      setFlash(reply, 'error', `Failed to save produce: ${err.message}`);
      return reply.redirect('/coffee/scan');
    }
  });

  // 5. View Produce Delivery Detail
  app.get('/coffee/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return reply.status(404).send('Not Found');

    const item = await getProduceById(db, id);
    if (!item) return reply.status(404).send('Produce record not found');

    const user = request.currentUser!;
    if (user.role === 'member' && user.memberId && item.produce.memberId !== user.memberId) {
      setFlash(reply, 'error', 'Access denied.');
      return reply.redirect('/coffee');
    }

    return await renderView(
      request,
      reply,
      'coffee/show.ejs',
      {
        item,
      },
      config,
      db,
    );
  });

  // 6. Verify / Approve / Reject Produce Record
  app.post('/coffee/:id/verify', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const body = request.body as { status: 'verified' | 'rejected'; notes?: string };
    const user = request.currentUser!;

    if (!['verified', 'rejected'].includes(body.status)) {
      setFlash(reply, 'error', 'Invalid verification status');
      return reply.redirect(`/coffee/${id}`);
    }

    const updated = await updateProduceStatus(db, id, user.id, body.status, body.notes);
    if (!updated) {
      setFlash(reply, 'error', 'Record not found');
      return reply.redirect('/coffee');
    }

    await recordAudit(db, {
      actorUserId: user.id,
      action: body.status === 'verified' ? 'verify' : 'reject',
      entity: 'coffee_produce',
      entityId: id,
      detail: { status: body.status, notes: body.notes },
      ip: request.ip,
    });

    setFlash(
      reply,
      'success',
      `Produce record ${body.status === 'verified' ? 'verified and approved' : 'rejected'}.`,
    );
    return reply.redirect(`/coffee/${id}`);
  });

  // 7. Factory Rates Management Page (Admin/Treasurer)
  app.get('/coffee/rates', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const query = request.query as { year?: string };
    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const rates = await listFactoryRates(db, year);

    return await renderView(
      request,
      reply,
      'coffee/rates.ejs',
      {
        rates,
        selectedYear: year,
      },
      config,
      db,
    );
  });

  // 8. Save / Update Factory Rate
  app.post('/coffee/rates', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const body = request.body as any;
    const user = request.currentUser!;

    try {
      if (!body.factoryName?.trim()) {
        setFlash(reply, 'error', 'Factory name is required.');
        return reply.redirect('/coffee/rates');
      }

      const ratePerKgCents = parseMoneyToCents(body.ratePerKg);
      if (!ratePerKgCents || ratePerKgCents <= 0) {
        setFlash(reply, 'error', 'Please provide a valid Rate per KG in KES.');
        return reply.redirect('/coffee/rates');
      }

      const seasonYear = parseInt(body.seasonYear, 10) || new Date().getFullYear();
      const grade = body.grade?.trim() || 'Cherry';

      const rate = await upsertFactoryRate(db, {
        factoryName: body.factoryName.trim(),
        societyName: body.societyName?.trim() || undefined,
        seasonYear,
        grade,
        ratePerKgCents,
        notes: body.notes?.trim() || undefined,
        updatedBy: user.id,
      });

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'set_rate',
        entity: 'factory_rate',
        entityId: rate.id,
        detail: { factoryName: rate.factoryName, grade: rate.grade, ratePerKgCents },
        ip: request.ip,
      });

      setFlash(reply, 'success', `Rate for ${rate.factoryName} (${rate.grade}) set to ${(rate.ratePerKgCents / 100).toFixed(2)} KES/KG for ${seasonYear}.`);
      return reply.redirect(`/coffee/rates?year=${seasonYear}`);
    } catch (err: any) {
      request.log.error(err);
      setFlash(reply, 'error', `Failed to save factory rate: ${err.message}`);
      return reply.redirect('/coffee/rates');
    }
  });

  // 9. Delete Factory Rate
  app.post('/coffee/rates/:id/delete', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (!isNaN(id)) {
      await deleteFactoryRate(db, id);
      setFlash(reply, 'success', 'Factory rate entry deleted.');
    }
    return reply.redirect('/coffee/rates');
  });

  // 10. API: Rate lookup for auto-population during scan
  app.get('/api/coffee/rate-lookup', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as { factory?: string; grade?: string; year?: string };
    if (!query.factory) {
      return reply.send({ found: false, ratePerKgCents: 0, rateFormatted: '0.00' });
    }

    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const grade = query.grade || 'Cherry';
    const rateCents = await getApplicableFactoryRate(db, query.factory, grade, year);

    if (rateCents !== null) {
      return reply.send({
        found: true,
        ratePerKgCents: rateCents,
        rateFormatted: (rateCents / 100).toFixed(2),
      });
    }

    return reply.send({ found: false, ratePerKgCents: 0, rateFormatted: '0.00' });
  });
}
