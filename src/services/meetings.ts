import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  meetings,
  meetingAttendance,
  fines,
  members,
  type Meeting,
} from '../db/schema.js';

export const meetingInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  scheduledAt: z.date(),
  location: z.string().trim().optional(),
  agenda: z.string().trim().optional(),
  absenceFineCents: z.coerce.number().int().min(0).default(0),
  createdBy: z.number().optional(),
});

export type MeetingInput = z.infer<typeof meetingInputSchema>;

export async function createMeeting(db: Db, input: MeetingInput): Promise<Meeting> {
  const inserted = await db
    .insert(meetings)
    .values({
      title: input.title,
      scheduledAt: input.scheduledAt,
      location: input.location || null,
      agenda: input.agenda || null,
      absenceFineCents: input.absenceFineCents,
      createdBy: input.createdBy || null,
    })
    .returning({ id: meetings.id })
    .get();

  const created = await db.select().from(meetings).where(eq(meetings.id, inserted!.id)).get();
  return created!;
}

export async function listMeetings(db: Db, limit = 50): Promise<Meeting[]> {
  return await db.select().from(meetings).orderBy(desc(meetings.scheduledAt)).limit(limit).all();
}

export async function getMeetingDetails(db: Db, meetingId: number) {
  const meeting = await db.select().from(meetings).where(eq(meetings.id, meetingId)).get();
  if (!meeting) return null;

  const attendance = await db
    .select({
      id: meetingAttendance.id,
      meetingId: meetingAttendance.meetingId,
      memberId: meetingAttendance.memberId,
      status: meetingAttendance.status,
      fineCents: meetingAttendance.fineCents,
      recordedAt: meetingAttendance.recordedAt,
      memberFirstName: members.firstName,
      memberLastName: members.lastName,
      memberNo: members.memberNo,
    })
    .from(meetingAttendance)
    .innerJoin(members, eq(meetingAttendance.memberId, members.id))
    .where(eq(meetingAttendance.meetingId, meetingId))
    .all();

  return { meeting, attendance };
}

export async function recordMeetingAttendance(
  db: Db,
  meetingId: number,
  attendanceList: Array<{ memberId: number; status: 'present' | 'absent' | 'excused' | 'late' }>,
  absenceFineCents: number,
  officerUserId: number,
): Promise<void> {
  for (const record of attendanceList) {
    const isAbsent = record.status === 'absent';
    const fineCents = isAbsent ? absenceFineCents : 0;

    const existing = await db
      .select()
      .from(meetingAttendance)
      .where(and(eq(meetingAttendance.meetingId, meetingId), eq(meetingAttendance.memberId, record.memberId)))
      .get();

    if (existing) {
      await db.update(meetingAttendance)
        .set({ status: record.status, fineCents, recordedAt: new Date() })
        .where(eq(meetingAttendance.id, existing.id));
    } else {
      await db.insert(meetingAttendance).values({
        meetingId,
        memberId: record.memberId,
        status: record.status,
        fineCents,
        recordedAt: new Date(),
      });
    }

    if (isAbsent && absenceFineCents > 0) {
      const existingFine = await db
        .select()
        .from(fines)
        .where(and(eq(fines.meetingId, meetingId), eq(fines.memberId, record.memberId)))
        .get();

      if (!existingFine) {
        await db.insert(fines).values({
          memberId: record.memberId,
          meetingId,
          reason: 'Absence from scheduled meeting',
          amountCents: absenceFineCents,
          status: 'outstanding',
          createdBy: officerUserId,
        });
      }
    }
  }
}

export async function listFines(db: Db, options: { status?: string; memberId?: number } = {}) {
  const conditions = [];
  if (options.status && options.status !== 'all') {
    conditions.push(eq(fines.status, options.status as any));
  }
  if (options.memberId) {
    conditions.push(eq(fines.memberId, options.memberId));
  }

  const query = db
    .select({
      fine: fines,
      memberFirstName: members.firstName,
      memberLastName: members.lastName,
      memberNo: members.memberNo,
    })
    .from(fines)
    .innerJoin(members, eq(fines.memberId, members.id))
    .orderBy(desc(fines.issuedAt));

  const rows = conditions.length > 0 ? await query.where(and(...conditions)).all() : await query.all();

  return rows.map((r: any) => ({
    ...r.fine,
    memberName: `${r.memberFirstName} ${r.memberLastName}`,
    memberNo: r.memberNo,
  }));
}
