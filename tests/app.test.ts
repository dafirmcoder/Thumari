import { describe, it, expect } from 'vitest';
import { store } from '../src/services/store.js';
import { computeInstallments } from '../src/lib/loan-math.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Thumari Vite PWA App & Store', () => {
  it('initializes store with default demo members and products', () => {
    const members = store.getMembers();
    expect(members.length).toBeGreaterThanOrEqual(5);

    const products = store.getLoanProducts();
    expect(products.length).toBeGreaterThanOrEqual(3);

    const kpis = store.getKPIs();
    expect(kpis.activeMemberCount).toBeGreaterThanOrEqual(5);
    expect(kpis.totalSavingsCents).toBeGreaterThan(0);
  });

  it('records new member contributions and updates KPI savings', () => {
    const initialSavings = store.getKPIs().totalSavingsCents;
    const newContribution = store.addContribution({
      memberId: 1,
      typeId: 1, // savings
      amountCents: 100000, // 1,000 KES
      paidAt: new Date().toISOString(),
      method: 'mpesa',
      reference: 'TEST_REF_123',
    });

    expect(newContribution.id).toBeDefined();
    const updatedSavings = store.getKPIs().totalSavingsCents;
    expect(updatedSavings).toBe(initialSavings + 100000);
  });

  it('creates and records coffee produce deliveries', () => {
    const produce = store.addCoffeeProduce({
      memberId: 1,
      deliveryDate: '2026-03-15',
      receiptNo: 'RCP-TEST-999',
      societyName: "Rung'eto Farmers Co-op",
      factoryName: 'Kii Factory',
      growerNo: 'FCS-0142',
      grossKg: 205.0,
      tareKg: 5.0,
      netKg: 200.0,
      ratePerKgCents: 12000,
      payoutCents: 2400000,
      verified: true,
    });

    expect(produce.id).toBeDefined();
    expect(produce.netKg).toBe(200.0);
    expect(produce.payoutCents).toBe(2400000);
  });

  it('has assetlinks.json in public/.well-known for Android TWA', () => {
    const assetlinksPath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
    expect(fs.existsSync(assetlinksPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(assetlinksPath, 'utf8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content[0].target.package_name).toBe('com.thumari.app');
  });

  it('has index.html with PWA meta tags and manifest link', () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);

    const html = fs.readFileSync(indexPath, 'utf8');
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('theme-color');
    expect(html).toContain('/src/main.tsx');
  });
});
