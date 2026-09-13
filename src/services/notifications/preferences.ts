import { eq } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { notificationPreferences } from '../../db/schema.js';
import { NOTIFICATION_EVENTS, getEventSpec } from './events.js';

export interface EffectivePreference {
  key: string;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
  userConfigurable: boolean;
}

export async function getEffectivePreferences(db: Db, userId: number): Promise<EffectivePreference[]> {
  const customPrefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .all();

  const customMap = new Map<string, boolean>();
  for (const p of customPrefs) {
    customMap.set(p.eventKey, p.enabled);
  }

  return NOTIFICATION_EVENTS.map((spec) => {
    let enabled = spec.defaultEnabled;
    if (spec.userConfigurable && customMap.has(spec.key)) {
      enabled = customMap.get(spec.key)!;
    }
    return {
      key: spec.key,
      label: spec.label,
      description: spec.description,
      category: spec.category,
      enabled,
      userConfigurable: spec.userConfigurable,
    };
  });
}

export async function isEventEnabledForUser(db: Db, userId: number, eventKey: string): Promise<boolean> {
  const spec = getEventSpec(eventKey);
  if (!spec) return false;
  if (!spec.userConfigurable) return true;

  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .all();

  const pref = prefs.find((p: { eventKey: string }) => p.eventKey === eventKey);
  return pref ? pref.enabled : spec.defaultEnabled;
}

export async function updateUserPreferences(db: Db, userId: number, updates: Record<string, boolean>): Promise<void> {
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .all();

  for (const [key, enabled] of Object.entries(updates)) {
    const spec = getEventSpec(key);
    if (!spec || !spec.userConfigurable) continue;

    const existing = prefs.find((p: { eventKey: string }) => p.eventKey === key);

    if (existing) {
      await db.update(notificationPreferences)
        .set({ enabled })
        .where(eq(notificationPreferences.id, existing.id));
    } else {
      await db.insert(notificationPreferences)
        .values({
          userId,
          eventKey: key,
          enabled,
        });
    }
  }
}
