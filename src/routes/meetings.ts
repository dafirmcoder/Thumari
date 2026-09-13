import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import type { NotificationQueue } from '../services/notifications/queue.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  listMeetings,
  createMeeting,
  getMeetingDetails,
  recordMeetingAttendance,
  listFines,
} from '../services/meetings.js';
import { listMembers } from '../services/members.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { formatDateTime } from '../lib/dates.js';
import { parseMoneyToCents } from '../lib/money.js';
import { dispatchNotification } from '../services/notifications/dispatch.js';

export function registerMeetingRoutes(
  app: FastifyInstance,
  db: Db,
  config: AppConfig,
  queue: NotificationQueue | null,
) {
  // Meetings List
  app.get('/meetings', { preHandler: requireAuth }, async (request, reply) => {
    const meetingsList = await listMeetings(db);
    return await renderView(request, reply, 'meetings/list.ejs', { meetings: meetingsList }, config, db);
  });

  // Schedule Meeting Page
  app.get('/meetings/new', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    return await renderView(request, reply, 'meetings/form.ejs', {}, config, db);
  });

  // Schedule Meeting POST
  app.post('/meetings', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    const body = request.body as any;
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    const absenceFineCents = parseMoneyToCents(body.absenceFine) || 0;

    try {
      const meeting = await createMeeting(db, {
        title: body.title,
        scheduledAt,
        location: body.location,
        agenda: body.agenda,
        absenceFineCents,
        createdBy: request.currentUser?.id,
      });

      // Broadcast Meeting Scheduled
      await dispatchNotification(db, queue, {
        eventKey: 'meeting.scheduled',
        title: 'New Meeting Scheduled',
        body: `${meeting.title} has been scheduled for ${formatDateTime(meeting.scheduledAt, config.org.timezone, config.org.locale)}${meeting.location ? ' at ' + meeting.location : ''}.`,
        url: `/meetings/${meeting.id}`,
      });

      setFlash(reply, 'success', 'Meeting scheduled and notice sent to members.');
      return reply.redirect(`/meetings/${meeting.id}`);
    } catch (err: any) {
      setFlash(reply, 'error', err.message || 'Failed to schedule meeting.');
      return reply.redirect('/meetings/new');
    }
  });

  // Meeting Detail & Attendance
  app.get('/meetings/:id', { preHandler: requireAuth }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const details = await getMeetingDetails(db, id);
    if (!details) {
      setFlash(reply, 'error', 'Meeting not found.');
      return reply.redirect('/meetings');
    }

    const membersList = await listMembers(db, { status: 'active' });
    return await renderView(request, reply, 'meetings/show.ejs', { ...details, members: membersList }, config, db);
  });

  // Save Attendance POST
  app.post('/meetings/:id/attendance', { preHandler: [requireAuth, requireRole(['admin', 'secretary'])] }, async (request, reply) => {
    const meetingId = parseInt((request.params as any).id, 10);
    const details = await getMeetingDetails(db, meetingId);
    if (!details) {
      return reply.redirect('/meetings');
    }

    const body = request.body as Record<string, any>;
    const membersList = await listMembers(db, { status: 'active' });
    const attendanceRecords = membersList.map((m: any) => {
      const status = body[`attendance_${m.id}`] || 'absent';
      return {
        memberId: m.id,
        status: status as any,
      };
    });

    await recordMeetingAttendance(
      db,
      meetingId,
      attendanceRecords,
      details.meeting.absenceFineCents,
      request.currentUser!.id,
    );

    setFlash(reply, 'success', 'Attendance record saved.');
    return reply.redirect(`/meetings/${meetingId}`);
  });

  // Fines List
  app.get('/fines', { preHandler: requireAuth }, async (request, reply) => {
    const finesList = await listFines(db);
    return await renderView(request, reply, 'meetings/fines.ejs', { fines: finesList }, config, db);
  });
}
