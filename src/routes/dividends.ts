import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { requireAuth } from '../plugins/auth.js';
import { calculateDividends } from '../services/dividends.js';
import { renderView } from '../web/views.js';
import { parseMoneyToCents } from '../lib/money.js';

export function registerDividendRoutes(app: FastifyInstance, db: Db, config: AppConfig) {
  // 1. Interactive Dividends Calculator Page
  app.get('/dividends', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as {
      profitPool?: string;
      retainedPct?: string;
      whtPct?: string;
      year?: string;
      basis?: 'contributions' | 'equal';
    };

    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const profitPoolCents = query.profitPool ? (parseMoneyToCents(query.profitPool) || 0) : 50000000; // Default 500,000 KES
    const retainedEarningsPercent = query.retainedPct !== undefined ? parseFloat(query.retainedPct) : 10;
    const withholdingTaxPercent = query.whtPct !== undefined ? parseFloat(query.whtPct) : 5;
    const distributionBasis = query.basis === 'equal' ? 'equal' : 'contributions';

    const result = await calculateDividends(db, {
      totalProfitPoolCents: profitPoolCents,
      retainedEarningsPercent,
      withholdingTaxPercent,
      year,
      distributionBasis,
    });

    return await renderView(
      request,
      reply,
      'dividends/calculator.ejs',
      {
        result,
        profitPoolCents,
        retainedEarningsPercent,
        withholdingTaxPercent,
        distributionBasis,
        year,
      },
      config,
      db,
    );
  });

  // 2. Export Dividends CSV
  app.get('/dividends/export', { preHandler: [requireAuth] }, async (request, reply) => {
    const query = request.query as {
      profitPool?: string;
      retainedPct?: string;
      whtPct?: string;
      year?: string;
      basis?: 'contributions' | 'equal';
    };

    const year = parseInt(query.year || '', 10) || new Date().getFullYear();
    const profitPoolCents = query.profitPool ? (parseMoneyToCents(query.profitPool) || 0) : 50000000;
    const retainedEarningsPercent = query.retainedPct !== undefined ? parseFloat(query.retainedPct) : 10;
    const withholdingTaxPercent = query.whtPct !== undefined ? parseFloat(query.whtPct) : 5;
    const distributionBasis = query.basis === 'equal' ? 'equal' : 'contributions';

    const result = await calculateDividends(db, {
      totalProfitPoolCents: profitPoolCents,
      retainedEarningsPercent,
      withholdingTaxPercent,
      year,
      distributionBasis,
    });

    let csv = `Member No,Member Name,Phone,Status,Cumulative Contributions (KES),Share %,Gross Dividend (KES),Withholding Tax (${result.withholdingTaxPercent}%),Net Dividend Payable (KES)\n`;
    for (const m of result.memberAllocations) {
      csv += `"${m.memberNo}","${m.fullName}","${m.phone || ''}","${m.status}",${(m.cumulativeContributionsCents / 100).toFixed(2)},${m.contributionSharePercent.toFixed(2)}%,${(m.grossDividendCents / 100).toFixed(2)},${(m.withholdingTaxCents / 100).toFixed(2)},${(m.netDividendPayableCents / 100).toFixed(2)}\n`;
    }

    csv += `\nSUMMARY,,,,,,\n`;
    csv += `Total Profit Pool (KES),${(result.totalProfitPoolCents / 100).toFixed(2)}\n`;
    csv += `Retained Reserves (${result.retainedEarningsPercent}%),${(result.retainedReservesCents / 100).toFixed(2)}\n`;
    csv += `Distributable Pool (KES),${(result.distributableDividendCents / 100).toFixed(2)}\n`;
    csv += `Total Net Dividend Payable (KES),${(result.totalNetPayableCents / 100).toFixed(2)}\n`;

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="thumari-dividends-${year}.csv"`);
    return reply.send(csv);
  });
}
