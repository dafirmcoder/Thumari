import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth, requireRole } from '../plugins/auth.js';
import {
  getSavingsReportByProduct,
  getMonthlyContributionsSummary,
  getAnnualContributionsSummary,
} from '../services/reports.js';
import { getAccountsReport } from '../services/accounts.js';
import {
  getMemberProduceBreakdown,
  getCoffeeProduceSummary,
  listProduceRecords,
} from '../services/coffee.js';
import { renderView } from '../web/views.js';
import { periodKey } from '../lib/dates.js';

export function registerReportRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  // Main Reports Overview
  app.get('/reports', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const currentYear = new Date().getFullYear();
    const currentPeriod = periodKey(new Date(), config.org.timezone);

    const savingsByProduct = await getSavingsReportByProduct(db);
    const monthlySummary = await getMonthlyContributionsSummary(db, currentPeriod);
    const annualSummary = await getAnnualContributionsSummary(db, currentYear);
    const coffeeStats = await getCoffeeProduceSummary(db);
    const coffeeMembers = await getMemberProduceBreakdown(db, currentYear);

    return await renderView(
      request,
      reply,
      'reports/index.ejs',
      {
        savingsByProduct,
        monthlySummary,
        annualSummary,
        coffeeStats,
        coffeeMembers,
        currentYear,
        currentPeriod,
      },
      config,
      db,
    );
  });

  // Monthly Contributions Summary
  app.get('/reports/contributions-monthly', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as { period?: string };
    const period = query.period || periodKey(new Date(), config.org.timezone);

    const report = await getMonthlyContributionsSummary(db, period);

    const user = request.currentUser!;
    if (user.role === 'member' && user.memberId) {
      report.members = report.members.filter((m) => m.memberId === user.memberId);
    }

    return await renderView(
      request,
      reply,
      'reports/contributions-monthly.ejs',
      {
        report,
        period,
      },
      config,
      db,
    );
  });

  // Annual Contributions Summary Matrix
  app.get('/reports/contributions-annual', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as { year?: string };
    const year = parseInt(query.year || '', 10) || new Date().getFullYear();

    const report = await getAnnualContributionsSummary(db, year);

    const user = request.currentUser!;
    if (user.role === 'member' && user.memberId) {
      report.members = report.members.filter((m) => m.memberId === user.memberId);
    }

    return await renderView(
      request,
      reply,
      'reports/contributions-annual.ejs',
      {
        report,
        year,
      },
      config,
      db,
    );
  });

  // Coffee Produce Annual Report
  app.get('/reports/coffee-produce', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as { year?: string };
    const year = parseInt(query.year || '', 10) || new Date().getFullYear();

    const user = request.currentUser!;
    const filterMemberId = user.role === 'member' && user.memberId ? user.memberId : undefined;

    const coffeeStats = await getCoffeeProduceSummary(db, filterMemberId);
    let memberBreakdown = await getMemberProduceBreakdown(db, year);
    if (filterMemberId) {
      memberBreakdown = memberBreakdown.filter((m) => m.memberId === filterMemberId);
    }
    const records = await listProduceRecords(db, { year, memberId: filterMemberId });

    return await renderView(
      request,
      reply,
      'reports/coffee-produce.ejs',
      {
        year,
        coffeeStats,
        memberBreakdown,
        records,
      },
      config,
      db,
    );
  });

  // Export CSV for Monthly Contributions
  app.get('/reports/contributions-monthly/export', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const query = request.query as { period?: string };
    const period = query.period || periodKey(new Date(), config.org.timezone);
    const report = await getMonthlyContributionsSummary(db, period);

    const typeHeaders = report.types.map((t) => `"${t.name} (KES)"`).join(',');
    let csv = `Member No,Member Name,${typeHeaders},Total (KES)\n`;
    for (const m of report.members) {
      const typeCols = report.types.map((t) => ((m.byType[t.id] || 0) / 100).toFixed(2));
      csv += `"${m.memberNo}","${m.fullName}",${typeCols.join(',')},${(m.totalCents / 100).toFixed(2)}\n`;
    }

    const typeTotalsCols = report.types.map((t) => ((report.typeTotals[t.id] || 0) / 100).toFixed(2));
    csv += `TOTALS,"ALL MEMBERS",${typeTotalsCols.join(',')},${(report.grandTotalCents / 100).toFixed(2)}\n`;

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="thumari-contributions-${period}.csv"`);
    return reply.send(csv);
  });

  // Export CSV for Annual Contributions
  app.get('/reports/contributions-annual/export', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const query = request.query as { year?: string };
    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const report = await getAnnualContributionsSummary(db, year);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthHeaders = months.map((m) => `"${m} (KES)"`).join(',');
    let csv = `Member No,Member Name,${monthHeaders},Annual Total (KES)\n`;
    for (const m of report.members) {
      const mCols = Array.from({ length: 12 }, (_, i) => ((m.months[i + 1] || 0) / 100).toFixed(2));
      csv += `"${m.memberNo}","${m.fullName}",${mCols.join(',')},${(m.totalCents / 100).toFixed(2)}\n`;
    }

    const mTotalsCols = Array.from({ length: 12 }, (_, i) => ((report.monthTotals[i + 1] || 0) / 100).toFixed(2));
    csv += `TOTALS,"ALL MEMBERS",${mTotalsCols.join(',')},${(report.grandTotalCents / 100).toFixed(2)}\n`;

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="thumari-contributions-${year}.csv"`);
    return reply.send(csv);
  });

  // Comprehensive Financial Accounts Report
  app.get('/reports/accounts', { preHandler: [requireAuth, requireRole(['admin', 'treasurer', 'secretary'])] }, async (request, reply) => {
    const query = request.query as { year?: string; month?: string };
    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const month = query.month ? parseInt(query.month, 10) : undefined;

    const report = await getAccountsReport(db, { year, month });

    return await renderView(
      request,
      reply,
      'reports/accounts.ejs',
      {
        report,
        selectedYear: year,
        selectedMonth: query.month || '',
      },
      config,
      db,
    );
  });

  // Export Accounts Report CSV
  app.get('/reports/accounts/export', { preHandler: [requireAuth, requireRole(['admin', 'treasurer'])] }, async (request, reply) => {
    const query = request.query as { year?: string; month?: string };
    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const month = query.month ? parseInt(query.month, 10) : undefined;

    const report = await getAccountsReport(db, { year, month });

    let csv = `THUMARI MEN'S ASSOCIATION - FINANCIAL ACCOUNTS STATEMENT\n`;
    csv += `Period:,"${report.periodLabel}"\n\n`;

    csv += `REVENUE & INFLOWS,AMOUNT (KES)\n`;
    csv += `Member Contributions (Total),${(report.inflows.totalContributionsCents / 100).toFixed(2)}\n`;
    for (const c of report.inflows.contributionsByType) {
      csv += `  - ${c.name} (${c.kind}),${(c.totalCents / 100).toFixed(2)}\n`;
    }
    csv += `Group Projects Income (Total),${(report.inflows.totalProjectIncomesCents / 100).toFixed(2)}\n`;
    for (const p of report.inflows.projectIncomesByProject) {
      csv += `  - ${p.projectName},${(p.totalCents / 100).toFixed(2)}\n`;
    }
    csv += `Fines & Penalties Collected,${(report.inflows.finesCollectedCents / 100).toFixed(2)}\n`;
    csv += `Loan Repayments Received,${(report.inflows.loanInterestRepaymentsCents / 100).toFixed(2)}\n`;
    csv += `TOTAL INFLOWS,${(report.inflows.totalInflowsCents / 100).toFixed(2)}\n\n`;

    csv += `OPERATING EXPENSES & OUTFLOWS,AMOUNT (KES)\n`;
    for (const e of report.outflows.expensesByCategory) {
      csv += `  - ${e.category} (${e.count} records),${(e.totalCents / 100).toFixed(2)}\n`;
    }
    csv += `Total Operating Expenses,${(report.outflows.totalOperatingExpensesCents / 100).toFixed(2)}\n`;
    csv += `Loans Disbursed (Principal),${(report.outflows.loansDisbursedCents / 100).toFixed(2)}\n`;
    csv += `TOTAL OUTFLOWS,${(report.outflows.totalOutflowsCents / 100).toFixed(2)}\n\n`;

    csv += `FINANCIAL POSITION SUMMARY,AMOUNT (KES)\n`;
    csv += `Net Operating Surplus (Revenue - Operating Exp),${(report.netOperatingSurplusCents / 100).toFixed(2)}\n`;
    csv += `Net Cash Flow (Total Inflows - Total Outflows),${(report.netCashFlowCents / 100).toFixed(2)}\n`;

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="thumari-accounts-${year}${month ? '-' + month : ''}.csv"`);
    return reply.send(csv);
  });
}
