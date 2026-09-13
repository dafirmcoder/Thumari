import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  listMembers,
  createMember,
  updateMember,
  getMemberById,
  memberInputSchema,
} from '../services/members.js';
import { listContributions } from '../services/contributions.js';
import { listLoans } from '../services/loans.js';
import { listFines } from '../services/meetings.js';
import { listProduceRecords } from '../services/coffee.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { fromDateInputValue } from '../lib/dates.js';
import { MEMBER_PHOTOS_DIR } from '../paths.js';
import { recordAudit } from '../services/audit.js';

export function registerMemberRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  // Ensure member photos directory exists
  fs.mkdirSync(MEMBER_PHOTOS_DIR, { recursive: true });

  // 1. Members List
  app.get('/members', { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as any;
    const membersList = await listMembers(db, { search: q.search, status: q.status });
    return await renderView(request, reply, 'members/list.ejs', { members: membersList, search: q.search, status: q.status }, config, db);
  });

  // 2. Create Member Page
  app.get('/members/new', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    return await renderView(request, reply, 'members/form.ejs', { member: null }, config, db);
  });

  // 3. Create Member POST (Multipart supported)
  app.post('/members', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    const user = request.currentUser!;
    let fields: Record<string, any> = {};
    let photoUrl: string | undefined = undefined;

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.filename) {
            const buf = await part.toBuffer();
            const ext = path.extname(part.filename) || '.jpg';
            const filename = `member_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
            const filePath = path.join(MEMBER_PHOTOS_DIR, filename);
            await fs.promises.writeFile(filePath, buf);
            photoUrl = `/static/uploads/members/${filename}`;
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } else {
      fields = (request.body as any) || {};
    }

    const joinDate = fields.joinDate ? fromDateInputValue(fields.joinDate, config.org.timezone) : new Date();

    try {
      const parsed = memberInputSchema.parse({
        firstName: fields.firstName,
        lastName: fields.lastName,
        phone: fields.phone,
        email: fields.email,
        nationalId: fields.nationalId,
        photoUrl: photoUrl || fields.photoUrl,
        joinDate: joinDate ?? new Date(),
        status: fields.status || 'active',
        notes: fields.notes,
      });

      const member = await createMember(db, parsed);

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'create',
        entity: 'member',
        entityId: member.id,
        detail: { memberNo: member.memberNo, name: `${member.firstName} ${member.lastName}`, nationalId: member.nationalId },
        ip: request.ip,
      });

      setFlash(reply, 'success', `Member ${member.firstName} ${member.lastName} (${member.memberNo}) registered.`);
      return reply.redirect(`/members/${member.id}`);
    } catch (err: any) {
      setFlash(reply, 'error', err.message || 'Error creating member.');
      return reply.redirect('/members/new');
    }
  });

  // 4. Edit Member Page
  app.get('/members/:id/edit', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const member = await getMemberById(db, id);
    if (!member) {
      setFlash(reply, 'error', 'Member not found.');
      return reply.redirect('/members');
    }
    return await renderView(request, reply, 'members/form.ejs', { member }, config, db);
  });

  // 5. Update Member POST
  app.post('/members/:id', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const user = request.currentUser!;
    let fields: Record<string, any> = {};
    let photoUrl: string | undefined = undefined;

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.filename) {
            const buf = await part.toBuffer();
            const ext = path.extname(part.filename) || '.jpg';
            const filename = `member_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
            const filePath = path.join(MEMBER_PHOTOS_DIR, filename);
            await fs.promises.writeFile(filePath, buf);
            photoUrl = `/static/uploads/members/${filename}`;
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } else {
      fields = (request.body as any) || {};
    }

    try {
      const updated = await updateMember(db, id, {
        firstName: fields.firstName,
        lastName: fields.lastName,
        phone: fields.phone,
        email: fields.email,
        nationalId: fields.nationalId,
        photoUrl: photoUrl !== undefined ? photoUrl : undefined,
        status: fields.status,
        notes: fields.notes,
      });

      if (!updated) {
        setFlash(reply, 'error', 'Member not found.');
        return reply.redirect('/members');
      }

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'update',
        entity: 'member',
        entityId: id,
        detail: { nationalId: fields.nationalId },
        ip: request.ip,
      });

      setFlash(reply, 'success', `Member profile for ${updated.firstName} ${updated.lastName} updated.`);
      return reply.redirect(`/members/${id}`);
    } catch (err: any) {
      setFlash(reply, 'error', `Failed to update member: ${err.message}`);
      return reply.redirect(`/members/${id}/edit`);
    }
  });

  // 6. Member Detail View
  app.get('/members/:id', { preHandler: requireAuth }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const member = await getMemberById(db, id);
    if (!member) {
      setFlash(reply, 'error', 'Member not found.');
      return reply.redirect('/members');
    }

    const memberContributions = await listContributions(db, { memberId: id, limit: 20 });
    const memberLoans = await listLoans(db, { memberId: id });
    const memberFines = await listFines(db, { memberId: id });
    const memberCoffeeProduce = await listProduceRecords(db, { memberId: id });

    return await renderView(
      request,
      reply,
      'members/show.ejs',
      {
        member,
        contributions: memberContributions,
        loans: memberLoans,
        fines: memberFines,
        coffeeProduce: memberCoffeeProduce,
      },
      config,
      db,
    );
  });
}
