import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  createExpense,
  listExpenses,
  getExpenseById,
  deleteExpense,
  getExpenseSummary,
  EXPENSE_CATEGORIES,
} from '../services/expenses.js';
import { listProjects } from '../services/projects.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { parseMoneyToCents } from '../lib/money.js';
import { EXPENSE_RECEIPTS_DIR } from '../paths.js';
import { recordAudit } from '../services/audit.js';

export function registerExpenseRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  // Ensure expense receipts upload directory exists
  fs.mkdirSync(EXPENSE_RECEIPTS_DIR, { recursive: true });

  // 1. List Expenses
  app.get('/expenses', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as {
      category?: string;
      projectId?: string;
      year?: string;
      month?: string;
    };

    const year = query.year ? parseInt(query.year, 10) : new Date().getFullYear();
    const month = query.month ? parseInt(query.month, 10) : undefined;
    const projectId = query.projectId ? parseInt(query.projectId, 10) : undefined;

    const records = await listExpenses(db, {
      category: query.category,
      projectId,
      year,
      month,
    });

    const summary = await getExpenseSummary(db, { year, month });
    const projectsList = await listProjects(db);

    return await renderView(
      request,
      reply,
      'expenses/list.ejs',
      {
        records,
        summary,
        categories: EXPENSE_CATEGORIES,
        projectsList,
        selectedCategory: query.category || '',
        selectedProjectId: query.projectId || '',
        selectedYear: year,
        selectedMonth: query.month || '',
      },
      config,
      db,
    );
  });

  // 2. New Expense Form
  app.get('/expenses/new', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    const projectsList = await listProjects(db);
    return await renderView(
      request,
      reply,
      'expenses/new.ejs',
      {
        categories: EXPENSE_CATEGORIES,
        projectsList,
      },
      config,
      db,
    );
  });

  // 3. Save Expense (Multipart / Form)
  app.post('/expenses', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    const user = request.currentUser!;
    let fields: Record<string, any> = {};
    let receiptPhotoUrl: string | undefined = undefined;

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.filename) {
            const buf = await part.toBuffer();
            const ext = path.extname(part.filename) || '.jpg';
            const filename = `expense_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
            const filePath = path.join(EXPENSE_RECEIPTS_DIR, filename);
            await fs.promises.writeFile(filePath, buf);
            receiptPhotoUrl = `/static/uploads/expenses/${filename}`;
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } else {
      fields = (request.body as any) || {};
    }

    try {
      const amountCents = parseMoneyToCents(fields.amount);
      if (!amountCents || amountCents <= 0) {
        setFlash(reply, 'error', 'Please provide a valid expense amount in KES.');
        return reply.redirect('/expenses/new');
      }

      if (!fields.payee?.trim() || !fields.purpose?.trim() || !fields.category) {
        setFlash(reply, 'error', 'Please fill in all required fields (Payee, Purpose, Category).');
        return reply.redirect('/expenses/new');
      }

      const expenseDate = fields.expenseDate ? new Date(fields.expenseDate) : new Date();
      const projectId = fields.projectId ? parseInt(fields.projectId, 10) : undefined;

      const expense = await createExpense(db, {
        expenseDate,
        category: fields.category,
        amountCents,
        payee: fields.payee.trim(),
        purpose: fields.purpose.trim(),
        paymentMethod: fields.paymentMethod || 'mpesa',
        receiptNumber: fields.receiptNumber?.trim() || undefined,
        receiptPhotoUrl,
        projectId: projectId && !isNaN(projectId) ? projectId : undefined,
        recordedBy: user.id,
        approvedBy: user.role === 'admin' || user.role === 'treasurer' ? user.id : undefined,
        notes: fields.notes?.trim() || undefined,
      });

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'create',
        entity: 'expense',
        entityId: expense.id,
        detail: { amountCents, category: fields.category, payee: fields.payee },
        ip: request.ip,
      });

      setFlash(reply, 'success', 'Expense recorded successfully!');
      return reply.redirect('/expenses');
    } catch (err: any) {
      request.log.error(err);
      setFlash(reply, 'error', `Failed to record expense: ${err.message}`);
      return reply.redirect('/expenses/new');
    }
  });

  // 4. Delete Expense
  app.post('/expenses/:id/delete', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const user = request.currentUser!;

    if (!isNaN(id)) {
      await deleteExpense(db, id);
      await recordAudit(db, {
        actorUserId: user.id,
        action: 'delete',
        entity: 'expense',
        entityId: id,
        ip: request.ip,
      });
      setFlash(reply, 'success', 'Expense record deleted.');
    }
    return reply.redirect('/expenses');
  });
}
