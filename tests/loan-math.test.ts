import { describe, it, expect } from 'vitest';
import {
  computeInstallments,
  computePenaltyCents,
  allocatePayment,
  installmentStatus,
} from '../src/lib/loan-math.js';

describe('Loan Math & Amortization', () => {
  it('computes flat rate loan schedule correctly', () => {
    const res = computeInstallments({
      principalCents: 10000000, // 100,000 TSh
      monthlyRateBps: 200, // 2% per month
      method: 'flat',
      termMonths: 5,
    });

    expect(res.installments.length).toBe(5);
    expect(res.totalInterestCents).toBe(1000000); // 10,000 TSh interest
    expect(res.totalPayableCents).toBe(11000000); // 110,000 TSh total
    
    // Sum of principal installments equals original principal
    const sumPrincipal = res.installments.reduce((acc, i) => acc + i.principalCents, 0);
    expect(sumPrincipal).toBe(10000000);
  });

  it('computes reducing balance amortized schedule correctly', () => {
    const res = computeInstallments({
      principalCents: 10000000,
      monthlyRateBps: 150, // 1.5% per month
      method: 'reducing',
      termMonths: 6,
    });

    expect(res.installments.length).toBe(6);
    expect(res.totalPayableCents).toBeGreaterThan(10000000);
    const sumPrincipal = res.installments.reduce((acc, i) => acc + i.principalCents, 0);
    expect(sumPrincipal).toBe(10000000);
  });

  it('calculates daily prorated overdue penalties', () => {
    // 100,000 TSh overdue at 2% monthly penalty for 15 days
    const penalty = computePenaltyCents(10000000, 200, 15);
    expect(penalty).toBe(100000); // 1,000 TSh penalty
  });

  it('allocates repayments in waterfall order with penalty first', () => {
    const schedule = [
      {
        installmentNo: 1,
        totalCents: 20000,
        paidCents: 0,
        penaltyCents: 5000,
        dueDate: new Date('2026-01-01'),
      },
      {
        installmentNo: 2,
        totalCents: 20000,
        paidCents: 0,
        penaltyCents: 0,
        dueDate: new Date('2026-02-01'),
      },
    ];

    // Pay 30,000 cents
    const res = allocatePayment(schedule, 30000);
    expect(res.totalAppliedCents).toBe(30000);
    expect(res.unappliedCents).toBe(0);

    // Installment 1: 5,000 penalty + 20,000 principal/interest = 25,000 -> settled
    expect(res.allocations[0]?.settled).toBe(true);
    expect(res.allocations[0]?.appliedCents).toBe(25000);

    // Installment 2: remaining 5,000 applied -> not settled
    expect(res.allocations[1]?.settled).toBe(false);
    expect(res.allocations[1]?.appliedCents).toBe(5000);
  });
});
