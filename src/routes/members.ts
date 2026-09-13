import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  listMembers,
  createMember,
  getMemberById,
  memberInputSchema,
} from '../services/members.js';
import { listContributions } from '../services/contributions.js';
import { listLoans } from '../services/loans.js';
import { listFines } from '../services/meetings.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { fromDateInputValue } from '../lib/dates.js';

export function registerMemberRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  // Members List
  app.get('/members', { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as any;
    const membersList = await listMembers(db, { search: q.search, status: q.status });
    return await renderView(request, reply, 'members/list.ejs', { members: membersList, search: q.search, status: q.status }, config, db);
  });

  // Create Member Page
  app.get('/members/new', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    return await renderView(request, reply, 'members/form.ejs', { member: null }, config, db);
  });

  // Create Member POST
  app.post('/members', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    const body = request.body as any;
    const joinDate = body.joinDate ? fromDateInputValue(body.joinDate, config.org.timezone) : new Date();

    try {
      const parsed = memberInputSchema.parse({
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        nationalId: body.nationalId,
        joinDate: joinDate ?? new Date(),
        status: body.status || 'active',
        notes: body.notes,
      });

      const member = await createMember(db, parsed);
      setFlash(reply, 'success', `Member ${member.firstName} ${member.lastName} (${member.memberNo}) registered.`);
      return reply.redirect(`/members/${member.id}`);
    } catch (err: any) {
      setFlash(reply, 'error', err.message || 'Error creating member.');
      return reply.redirect('/members/new');
    }
  });

  // Member Detail
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

    return await renderView(
      request,
      reply,
      'members/show.ejs',
      {
        member,
        contributions: memberContributions,
        loans: memberLoans,
        fines: memberFines,
      },
      config,
      db,
    );
  });
}
