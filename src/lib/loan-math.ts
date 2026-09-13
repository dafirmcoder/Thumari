import type { InterestMethod, InstallmentStatus } from '../db/schema.js';

export interface PaymentScheduleInput {
  principalCents: number;
  monthlyRateBps: number;
  method: InterestMethod;
  termMonths: number;
}

export interface ComputedInstallment {
  installmentNo: number;
  principalCents: number;
  interestCents: number;
  totalCents: number;
}

export interface ScheduleCalculationResult {
  installments: ComputedInstallment[];
  totalInterestCents: number;
  totalPayableCents: number;
  levelPaymentCents: number;
}

export function computeInstallments(input: PaymentScheduleInput): ScheduleCalculationResult {
  const { principalCents, monthlyRateBps, method, termMonths } = input;

  if (principalCents <= 0 || termMonths <= 0) {
    throw new Error('Principal and term must be greater than zero');
  }

  if (method === 'flat') {
    const totalInterestCents = Math.round((principalCents * monthlyRateBps * termMonths) / 10000);
    const totalPayableCents = principalCents + totalInterestCents;

    const basePrincipal = Math.floor(principalCents / termMonths);
    const principalRemainder = principalCents - basePrincipal * termMonths;

    const baseInterest = Math.floor(totalInterestCents / termMonths);
    const interestRemainder = totalInterestCents - baseInterest * termMonths;

    const installments: ComputedInstallment[] = [];
    for (let i = 1; i <= termMonths; i++) {
      const p = basePrincipal + (i === termMonths ? principalRemainder : 0);
      const intr = baseInterest + (i === termMonths ? interestRemainder : 0);
      installments.push({
        installmentNo: i,
        principalCents: p,
        interestCents: intr,
        totalCents: p + intr,
      });
    }

    return {
      installments,
      totalInterestCents,
      totalPayableCents,
      levelPaymentCents: Math.round(totalPayableCents / termMonths),
    };
  }

  // Reducing Balance (Amortized Level Payment)
  const r = monthlyRateBps / 10000;
  if (r === 0) {
    const basePrincipal = Math.floor(principalCents / termMonths);
    const remainder = principalCents - basePrincipal * termMonths;
    const installments: ComputedInstallment[] = [];
    for (let i = 1; i <= termMonths; i++) {
      const p = basePrincipal + (i === termMonths ? remainder : 0);
      installments.push({
        installmentNo: i,
        principalCents: p,
        interestCents: 0,
        totalCents: p,
      });
    }
    return {
      installments,
      totalInterestCents: 0,
      totalPayableCents: principalCents,
      levelPaymentCents: basePrincipal,
    };
  }

  const factor = Math.pow(1 + r, termMonths);
  const payment = Math.round((principalCents * r * factor) / (factor - 1));

  let balance = principalCents;
  const installments: ComputedInstallment[] = [];
  let totalInterestCents = 0;

  for (let i = 1; i <= termMonths; i++) {
    const interest = Math.round(balance * r);
    let principalPart = i === termMonths ? balance : payment - interest;
    if (principalPart > balance) principalPart = balance;
    if (principalPart < 0) principalPart = 0;

    const total = principalPart + interest;
    balance -= principalPart;
    totalInterestCents += interest;

    installments.push({
      installmentNo: i,
      principalCents: principalPart,
      interestCents: interest,
      totalCents: total,
    });
  }

  const totalPayableCents = principalCents + totalInterestCents;
  return {
    installments,
    totalInterestCents,
    totalPayableCents,
    levelPaymentCents: payment,
  };
}

export function computePenaltyCents(overdueCents: number, monthlyRateBps: number, daysOverdue: number): number {
  if (overdueCents <= 0 || daysOverdue <= 0 || monthlyRateBps <= 0) return 0;
  const numerator = BigInt(overdueCents) * BigInt(monthlyRateBps) * BigInt(daysOverdue);
  const denominator = 300000n; // 10,000 basis points * 30 days
  const result = (numerator + denominator / 2n) / denominator;
  return Number(result);
}

export interface AllocatableInstallment {
  installmentNo: number;
  totalCents: number;
  paidCents: number;
  penaltyCents: number;
  dueDate: Date;
}

export interface AllocationLine {
  installmentNo: number;
  appliedCents: number;
  penaltyPortionCents: number;
  installmentPortionCents: number;
  newPaidCents: number;
  obligationCents: number;
  settled: boolean;
}

export function allocatePayment(
  schedule: readonly AllocatableInstallment[],
  amountCents: number,
): { allocations: AllocationLine[]; unappliedCents: number; totalAppliedCents: number } {
  let available = Math.max(0, amountCents);
  let totalAppliedCents = 0;
  const allocations: AllocationLine[] = [];

  for (const row of schedule) {
    const obligation = row.totalCents + row.penaltyCents;
    const remaining = obligation - row.paidCents;
    if (remaining <= 0) continue;

    if (available <= 0) break;

    const take = Math.min(remaining, available);
    const penaltyPaidAlready = Math.min(row.paidCents, row.penaltyCents);
    const penaltyOutstanding = row.penaltyCents - penaltyPaidAlready;

    const penaltyPortion = Math.min(take, penaltyOutstanding);
    const installmentPortion = take - penaltyPortion;
    const newPaid = row.paidCents + take;

    allocations.push({
      installmentNo: row.installmentNo,
      appliedCents: take,
      penaltyPortionCents: penaltyPortion,
      installmentPortionCents: installmentPortion,
      newPaidCents: newPaid,
      obligationCents: obligation,
      settled: newPaid >= obligation,
    });

    available -= take;
    totalAppliedCents += take;
  }

  return {
    allocations,
    unappliedCents: available,
    totalAppliedCents,
  };
}

export function installmentStatus(row: {
  totalCents: number;
  penaltyCents: number;
  paidCents: number;
  dueDate: Date;
}, asOf: Date, graceDays = 0): InstallmentStatus {
  const obligation = row.totalCents + row.penaltyCents;
  if (row.paidCents >= obligation) return 'paid';
  if (row.paidCents > 0) return 'partial';
  const overdueThreshold = new Date(row.dueDate.getTime() + graceDays * 86400000);
  if (asOf.getTime() > overdueThreshold.getTime()) return 'overdue';
  return 'pending';
}
