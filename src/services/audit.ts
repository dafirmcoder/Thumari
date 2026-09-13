import { desc } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { auditLog, type AuditLogRow } from '../db/schema.js';

export interface RecordAuditInput {
  actorUserId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  detail?: Record<string, unknown>;
  ip?: string;
}

export async function recordAudit(db: Db, input: RecordAuditInput): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    detail: input.detail ? JSON.stringify(input.detail) : null,
    ip: input.ip,
  });
}

export async function listRecentAuditLogs(db: Db, limit = 50): Promise<AuditLogRow[]> {
  return await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).all();
}
