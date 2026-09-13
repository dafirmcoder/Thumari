import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/index.js';
import { formatMoney, centsToDecimalString } from '../lib/money.js';
import { formatDate, formatDateTime, formatPeriodLabel, toDateInputValue } from '../lib/dates.js';
import { readAndClearFlash } from '../lib/flash.js';
import { getUnreadNotificationCount } from '../services/notifications/inbox.js';

export async function renderView(
  request: FastifyRequest,
  reply: FastifyReply,
  template: string,
  data: Record<string, unknown> = {},
  config: AppConfig,
  db?: Db,
) {
  const flash = readAndClearFlash(request, reply);
  const unreadCount = (request.currentUser && db)
    ? await getUnreadNotificationCount(db, request.currentUser.id)
    : 0;

  const viewData = {
    config,
    org: config.org,
    currentUser: request.currentUser,
    csrfToken: request.csrfToken,
    flash,
    unreadNotificationCount: unreadCount,
    currentPath: request.url,
    // Helpers
    formatMoney: (cents: number) =>
      formatMoney(cents, {
        symbol: config.org.currencySymbol,
        locale: config.org.locale,
      }),
    centsToDecimal: centsToDecimalString,
    formatDate: (d: Date | null | undefined) =>
      formatDate(d, config.org.timezone, config.org.locale),
    formatDateTime: (d: Date | null | undefined) =>
      formatDateTime(d, config.org.timezone, config.org.locale),
    formatPeriod: (p: string) =>
      formatPeriodLabel(p, config.org.timezone, config.org.locale),
    toDateInput: (d: Date) => toDateInputValue(d, config.org.timezone),
    ...data,
  };

  return reply.view(template, viewData);
}
