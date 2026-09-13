import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import type { NotificationQueue } from '../services/notifications/queue.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  listLoans,
  listLoanProducts,
  applyForLoan,
  approveLoan,
  rejectLoan,
  disburseLoan,
  recordLoanRepayment,
  getLoanDetails,
} from '../services/loans.js';
import { listMembers } from '../services/members.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { fromDateInputValue } from '../lib/dates.js';
import { parseMoneyToCents, formatMoney } from '../lib/money.js';
import { dispatchNotification } from '../services/notifications/dispatch.js';

export function registerLoanRoutes(
  app: FastifyInstance,
  db: Db,
  config: AppConfig,
  queue: NotificationQueue | null,
) {
  // Loans List
  app.get('/loans', { preHandler: requireAuth }, async (request, reply) => {
    const q = request.query as any;
    const loansList = await listLoans(db, { status: q.status });
    return await renderView(request, reply, 'loans/list.ejs', { loans: loansList, status: q.status }, config, db);
  });

  // Apply for Loan Page
  app.get('/loans/new', { preHandler: requireAuth }, async (request, reply) => {
    const membersList = await listMembers(db, { status: 'active' });
    const products = await listLoanProducts(db, true);
    return await renderView(request, reply, 'loans/form.ejs', { members: membersList, products }, config, db);
  });

  // Apply for Loan POST
  app.post('/loans', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as any;
    const memberId = parseInt(body.memberId, 10);
    const productId = parseInt(body.productId, 10);
    const principalCents = parseMoneyToCents(body.principal);
    const termMonths = parseInt(body.termMonths, 10);

    const guarantorIds = Array.isArray(body.guarantors)
      ? body.guarantors.map((g: string) => parseInt(g, 10))
      : body.guarantors
        ? [parseInt(body.guarantors, 10)]
        : [];

    if (!memberId || !productId || !principalCents || !termMonths) {
      setFlash(reply, 'error', 'Please fill in all required loan fields with valid values.');
      return reply.redirect('/loans/new');
    }

    const { loan, errors } = await applyForLoan(db, {
      memberId,
      productId,
      principalCents,
      termMonths,
      purpose: body.purpose,
      guarantorMemberIds: guarantorIds,
    });

    if (errors && errors.length > 0) {
      setFlash(reply, 'error', errors.join(' '));
      return reply.redirect('/loans/new');
    }

    // Notify Officers
    await dispatchNotification(db, queue, {
      eventKey: 'loan.application.received',
      title: 'New Loan Application',
      body: `A new loan application (${loan.loanNo}) of ${formatMoney(principalCents, { symbol: config.org.currencySymbol })} was submitted for review.`,
      url: `/loans/${loan.id}`,
    });

    setFlash(reply, 'success', `Loan application ${loan.loanNo} submitted for approval.`);
    return reply.redirect(`/loans/${loan.id}`);
  });

  // Loan Detail Page
  app.get('/loans/:id', { preHandler: requireAuth }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const details = await getLoanDetails(db, id);
    if (!details) {
      setFlash(reply, 'error', 'Loan not found.');
      return reply.redirect('/loans');
    }
    return await renderView(request, reply, 'loans/show.ejs', { ...details }, config, db);
  });

  // Approve Loan
  app.post('/loans/:id/approve', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const body = request.body as any;
    const loan = await approveLoan(db, id, request.currentUser!.id, body.notes);

    if (!loan) {
      setFlash(reply, 'error', 'Failed to approve loan (must be in pending state).');
      return reply.redirect(`/loans/${id}`);
    }

    await dispatchNotification(db, queue, {
      eventKey: 'loan.approved',
      title: 'Loan Approved',
      body: `Congratulations! Your loan ${loan.loanNo} of ${formatMoney(loan.principalCents, { symbol: config.org.currencySymbol })} has been approved.`,
      url: `/loans/${loan.id}`,
      memberId: loan.memberId,
    });

    setFlash(reply, 'success', `Loan ${loan.loanNo} approved successfully.`);
    return reply.redirect(`/loans/${id}`);
  });

  // Reject Loan
  app.post('/loans/:id/reject', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const body = request.body as any;
    const loan = await rejectLoan(db, id, request.currentUser!.id, body.notes);

    if (!loan) {
      setFlash(reply, 'error', 'Failed to reject loan.');
      return reply.redirect(`/loans/${id}`);
    }

    await dispatchNotification(db, queue, {
      eventKey: 'loan.rejected',
      title: 'Loan Application Update',
      body: `Your loan application ${loan.loanNo} has been declined. ${body.notes ? 'Reason: ' + body.notes : ''}`,
      url: `/loans/${loan.id}`,
      memberId: loan.memberId,
    });

    setFlash(reply, 'info', `Loan ${loan.loanNo} rejected.`);
    return reply.redirect(`/loans/${id}`);
  });

  // Disburse Loan
  app.post('/loans/:id/disburse', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const body = request.body as any;
    const firstDueDate = body.firstDueDate
      ? fromDateInputValue(body.firstDueDate, config.org.timezone)
      : new Date(Date.now() + 30 * 86400000);

    const loan = await disburseLoan(db, id, firstDueDate ?? new Date(), config.org.timezone);
    if (!loan) {
      setFlash(reply, 'error', 'Loan must be approved before disbursement.');
      return reply.redirect(`/loans/${id}`);
    }

    await dispatchNotification(db, queue, {
      eventKey: 'loan.disbursed',
      title: 'Loan Disbursed',
      body: `Loan ${loan.loanNo} funds of ${formatMoney(loan.principalCents, { symbol: config.org.currencySymbol })} have been disbursed. Installment schedule is now active.`,
      url: `/loans/${loan.id}`,
      memberId: loan.memberId,
    });

    setFlash(reply, 'success', `Loan ${loan.loanNo} disbursed and schedule generated.`);
    return reply.redirect(`/loans/${id}`);
  });

  // Record Loan Repayment
  app.post('/loans/:id/repay', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const id = parseInt((request.params as any).id, 10);
    const body = request.body as any;
    const amountCents = parseMoneyToCents(body.amount);
    const paidAt = body.paidAt ? fromDateInputValue(body.paidAt, config.org.timezone) : new Date();

    if (!amountCents || amountCents <= 0) {
      setFlash(reply, 'error', 'Please enter a valid repayment amount.');
      return reply.redirect(`/loans/${id}`);
    }

    const res = await recordLoanRepayment(db, id, {
      amountCents,
      paidAt: paidAt ?? new Date(),
      method: body.method || 'cash',
      reference: body.reference || undefined,
      notes: body.notes || undefined,
      recordedBy: request.currentUser?.id,
    });

    if (!res) {
      setFlash(reply, 'error', 'Failed to record repayment for this loan.');
      return reply.redirect(`/loans/${id}`);
    }

    await dispatchNotification(db, queue, {
      eventKey: 'loan.repayment.received',
      title: 'Loan Repayment Receipt',
      body: `Repayment of ${formatMoney(amountCents, { symbol: config.org.currencySymbol })} for Loan ${res.loan.loanNo} credited. Remaining balance: ${formatMoney(res.loan.outstandingCents, { symbol: config.org.currencySymbol })}.`,
      url: `/loans/${res.loan.id}`,
      memberId: res.loan.memberId,
    });

    setFlash(reply, 'success', 'Repayment recorded successfully.');
    return reply.redirect(`/loans/${id}`);
  });
}
