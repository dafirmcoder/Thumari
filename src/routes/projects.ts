import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  createProject,
  listProjects,
  getProjectById,
  recordProjectIncome,
  listProjectIncomes,
  getProjectFinancials,
} from '../services/projects.js';
import { listExpenses } from '../services/expenses.js';
import { renderView } from '../web/views.js';
import { setFlash } from '../lib/flash.js';
import { parseMoneyToCents } from '../lib/money.js';
import { recordAudit } from '../services/audit.js';

export function registerProjectRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  // 1. Projects Dashboard & Portfolio
  app.get('/projects', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as { status?: 'planning' | 'active' | 'completed' | 'suspended' };
    const projects = await listProjects(db, { status: query.status });

    const totalIncome = projects.reduce((s, p) => s + p.totalIncomeCents, 0);
    const totalExpense = projects.reduce((s, p) => s + p.totalExpenseCents, 0);
    const totalNetProfit = totalIncome - totalExpense;

    return await renderView(
      request,
      reply,
      'projects/list.ejs',
      {
        projects,
        totalIncome,
        totalExpense,
        totalNetProfit,
        selectedStatus: query.status || '',
      },
      config,
      db,
    );
  });

  // 2. Create Project Form
  app.get('/projects/new', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    return await renderView(request, reply, 'projects/new.ejs', {}, config, db);
  });

  // 3. Save Project
  app.post('/projects', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    const body = request.body as any;
    const user = request.currentUser!;

    try {
      if (!body.name?.trim() || !body.code?.trim()) {
        setFlash(reply, 'error', 'Project name and unique code are required.');
        return reply.redirect('/projects/new');
      }

      const targetBudgetCents = parseMoneyToCents(body.targetBudget) || 0;
      const startDate = body.startDate ? new Date(body.startDate) : new Date();

      const project = await createProject(db, {
        name: body.name.trim(),
        code: body.code.trim().toUpperCase(),
        description: body.description?.trim() || undefined,
        status: body.status || 'active',
        startDate,
        targetBudgetCents,
        createdBy: user.id,
      });

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'create',
        entity: 'group_project',
        entityId: project.id,
        detail: { name: project.name, code: project.code },
        ip: request.ip,
      });

      setFlash(reply, 'success', `Group project "${project.name}" registered successfully!`);
      return reply.redirect(`/projects/${project.id}`);
    } catch (err: any) {
      request.log.error(err);
      setFlash(reply, 'error', `Failed to create project: ${err.message}`);
      return reply.redirect('/projects/new');
    }
  });

  // 4. View Project Detail & Incomes
  app.get('/projects/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return reply.status(404).send('Not Found');

    const fin = await getProjectFinancials(db, id);
    if (!fin) return reply.status(404).send('Project not found');

    const incomes = await listProjectIncomes(db, id);
    const directExpenses = await listExpenses(db, { projectId: id });

    return await renderView(
      request,
      reply,
      'projects/show.ejs',
      {
        fin,
        incomes,
        directExpenses,
      },
      config,
      db,
    );
  });

  // 5. Record Project Income Form
  app.get('/projects/:id/income/new', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return reply.status(404).send('Not Found');

    const project = await getProjectById(db, id);
    if (!project) return reply.status(404).send('Project not found');

    return await renderView(
      request,
      reply,
      'projects/income-new.ejs',
      { project },
      config,
      db,
    );
  });

  // 6. Save Project Income
  app.post('/projects/:id/income', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);
    const body = request.body as any;
    const user = request.currentUser!;

    try {
      const amountCents = parseMoneyToCents(body.amount);
      if (!amountCents || amountCents <= 0) {
        setFlash(reply, 'error', 'Please enter a valid income amount in KES.');
        return reply.redirect(`/projects/${id}/income/new`);
      }

      if (!body.source?.trim()) {
        setFlash(reply, 'error', 'Please describe the revenue source / customer.');
        return reply.redirect(`/projects/${id}/income/new`);
      }

      const incomeDate = body.incomeDate ? new Date(body.incomeDate) : new Date();

      const income = await recordProjectIncome(db, {
        projectId: id,
        incomeDate,
        source: body.source.trim(),
        amountCents,
        paymentMethod: body.paymentMethod || 'mpesa',
        receiptNo: body.receiptNo?.trim() || undefined,
        recordedBy: user.id,
        notes: body.notes?.trim() || undefined,
      });

      await recordAudit(db, {
        actorUserId: user.id,
        action: 'create',
        entity: 'project_income',
        entityId: income.id,
        detail: { projectId: id, amountCents, source: body.source },
        ip: request.ip,
      });

      setFlash(reply, 'success', 'Project income recorded successfully!');
      return reply.redirect(`/projects/${id}`);
    } catch (err: any) {
      request.log.error(err);
      setFlash(reply, 'error', `Failed to record project income: ${err.message}`);
      return reply.redirect(`/projects/${id}/income/new`);
    }
  });
}
