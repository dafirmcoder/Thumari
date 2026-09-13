import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  loans,
  loanProducts,
  loanSchedule,
  loanRepayments,
  loanGuarantors,
  members,
  type Loan,
  type LoanProduct,
  type LoanRepayment,
  PAYMENT_METHODS,
} from '../db/schema.js';
import { computeInstallments, allocatePayment } from '../lib/loan-math.js';
import { installmentDueDate } from '../lib/dates.js';
import { getMemberSavingsCents } from './members.js';

export const loanApplicationSchema = z.object({
  memberId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  principalCents: z.coerce.number().int().positive('Principal must be greater than zero'),
  termMonths: z.coerce.number().int().positive('Term must be at least 1 month'),
  purpose: z.string().trim().optional(),
  guarantorMemberIds: z.array(z.coerce.number().int().positive()).optional(),
});

export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;

export const loanRepaymentSchema = z.object({
  amountCents: z.coerce.number().int().positive('Payment amount must be greater than zero'),
  paidAt: z.date(),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  recordedBy: z.number().optional(),
});

export type LoanRepaymentInput = z.infer<typeof loanRepaymentSchema>;

export async function generateNextLoanNo(db: Db): Promise<string> {
  const last = await db
    .select({ loanNo: loans.loanNo })
    .from(loans)
    .orderBy(desc(loans.id))
    .limit(1)
    .get();

  if (!last) return 'L-0001';

  const match = /^L-(\d+)$/.exec(last.loanNo);
  if (!match) return `L-${Date.now().toString().slice(-4)}`;

  const nextNum = parseInt(match[1]!, 10) + 1;
  return `L-${nextNum.toString().padStart(4, '0')}`;
}

export async function listLoanProducts(db: Db, activeOnly = true): Promise<LoanProduct[]> {
  if (activeOnly) {
    return await db.select().from(loanProducts).where(eq(loanProducts.active, true)).all();
  }
  return await db.select().from(loanProducts).all();
}

export async function applyForLoan(
  db: Db,
  input: LoanApplicationInput,
): Promise<{ loan: Loan; errors?: string[] }> {
  const product = await db.select().from(loanProducts).where(eq(loanProducts.id, input.productId)).get();
  if (!product || !product.active) {
    return { loan: null as any, errors: ['Selected loan product is not active or does not exist'] };
  }

  const errors: string[] = [];

  if (product.minAmountCents > 0 && input.principalCents < product.minAmountCents) {
    errors.push(`Minimum loan amount is ${product.minAmountCents / 100}`);
  }
  if (product.maxAmountCents > 0 && input.principalCents > product.maxAmountCents) {
    errors.push(`Maximum loan amount is ${product.maxAmountCents / 100}`);
  }
  if (input.termMonths < product.minTermMonths || input.termMonths > product.maxTermMonths) {
    errors.push(`Loan term must be between ${product.minTermMonths} and ${product.maxTermMonths} months`);
  }

  if (product.maxMultipleOfSavings > 0) {
    const memberSavings = await getMemberSavingsCents(db, input.memberId);
    const maxAllowed = memberSavings * product.maxMultipleOfSavings;
    if (memberSavings === 0 || input.principalCents > maxAllowed) {
      errors.push(`Loan exceeds maximum allowed limit (${product.maxMultipleOfSavings}x of current savings: ${memberSavings / 100})`);
    }
  }

  const guarantors = input.guarantorMemberIds ?? [];
  if (product.requiresGuarantors && guarantors.length < product.guarantorsRequired) {
    errors.push(`This loan requires at least ${product.guarantorsRequired} guarantors.`);
  }

  if (errors.length > 0) {
    return { loan: null as any, errors };
  }

  const loanNo = await generateNextLoanNo(db);
  const now = new Date();

  const inserted = await db
    .insert(loans)
    .values({
      loanNo,
      memberId: input.memberId,
      productId: product.id,
      principalCents: input.principalCents,
      interestRateBps: product.interestRateBps,
      interestMethod: product.interestMethod,
      termMonths: input.termMonths,
      purpose: input.purpose || null,
      status: 'pending',
      appliedAt: now,
      totalPayableCents: 0,
      outstandingCents: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: loans.id })
    .get();

  if (guarantors.length > 0) {
    const perGuarantor = Math.round(input.principalCents / guarantors.length);
    for (const gId of guarantors) {
      if (gId !== input.memberId) {
        await db.insert(loanGuarantors).values({
          loanId: inserted!.id,
          memberId: gId,
          amountCents: perGuarantor,
          status: 'pending',
        });
      }
    }
  }

  const loan = await db.select().from(loans).where(eq(loans.id, inserted!.id)).get();
  return { loan: loan! };
}

export async function approveLoan(
  db: Db,
  loanId: number,
  officerUserId: number,
  notes?: string,
): Promise<Loan | null> {
  const loan = await db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (!loan || loan.status !== 'pending') return null;

  await db.update(loans)
    .set({
      status: 'approved',
      decisionBy: officerUserId,
      decisionAt: new Date(),
      decisionNotes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(loans.id, loanId));

  return (await db.select().from(loans).where(eq(loans.id, loanId)).get()) ?? null;
}

export async function rejectLoan(
  db: Db,
  loanId: number,
  officerUserId: number,
  notes?: string,
): Promise<Loan | null> {
  const loan = await db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (!loan || loan.status !== 'pending') return null;

  await db.update(loans)
    .set({
      status: 'rejected',
      decisionBy: officerUserId,
      decisionAt: new Date(),
      decisionNotes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(loans.id, loanId));

  return (await db.select().from(loans).where(eq(loans.id, loanId)).get()) ?? null;
}

export async function disburseLoan(
  db: Db,
  loanId: number,
  firstDueDate: Date,
  timezone: string,
): Promise<Loan | null> {
  const loan = await db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (!loan || loan.status !== 'approved') return null;

  const scheduleCalc = computeInstallments({
    principalCents: loan.principalCents,
    monthlyRateBps: loan.interestRateBps,
    method: loan.interestMethod,
    termMonths: loan.termMonths,
  });

  const now = new Date();

  for (let i = 0; i < scheduleCalc.installments.length; i++) {
    const inst = scheduleCalc.installments[i]!;
    const dueDate = installmentDueDate(firstDueDate, i, timezone);

    await db.insert(loanSchedule).values({
      loanId: loan.id,
      installmentNo: inst.installmentNo,
      dueDate,
      principalCents: inst.principalCents,
      interestCents: inst.interestCents,
      totalCents: inst.totalCents,
      paidCents: 0,
      penaltyCents: 0,
      status: 'pending',
    });
  }

  await db.update(loans)
    .set({
      status: 'disbursed',
      disbursedAt: now,
      firstDueDate,
      totalPayableCents: scheduleCalc.totalPayableCents,
      outstandingCents: scheduleCalc.totalPayableCents,
      updatedAt: now,
    })
    .where(eq(loans.id, loanId));

  return (await db.select().from(loans).where(eq(loans.id, loanId)).get()) ?? null;
}

export async function recordLoanRepayment(
  db: Db,
  loanId: number,
  input: LoanRepaymentInput,
): Promise<{ repayment: LoanRepayment; loan: Loan; allocations: any[] } | null> {
  const loan = await db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (!loan || loan.status !== 'disbursed') return null;

  const scheduleRows = await db
    .select()
    .from(loanSchedule)
    .where(eq(loanSchedule.loanId, loanId))
    .orderBy(loanSchedule.installmentNo)
    .all();

  const allocatable = scheduleRows.map((r) => ({
    installmentNo: r.installmentNo,
    totalCents: r.totalCents,
    paidCents: r.paidCents,
    penaltyCents: r.penaltyCents,
    dueDate: r.dueDate,
  }));

  const result = allocatePayment(allocatable, input.amountCents);

  for (const alloc of result.allocations) {
    const isPaid = alloc.settled;
    await db.update(loanSchedule)
      .set({
        paidCents: alloc.newPaidCents,
        status: isPaid ? 'paid' : 'partial',
        paidAt: isPaid ? input.paidAt : null,
      })
      .where(and(eq(loanSchedule.loanId, loanId), eq(loanSchedule.installmentNo, alloc.installmentNo)));
  }

  const insertedRepayment = await db
    .insert(loanRepayments)
    .values({
      loanId,
      memberId: loan.memberId,
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      method: input.method ?? 'cash',
      reference: input.reference || null,
      notes: input.notes || null,
      recordedBy: input.recordedBy || null,
    })
    .returning({ id: loanRepayments.id })
    .get();

  const updatedSchedule = await db.select().from(loanSchedule).where(eq(loanSchedule.loanId, loanId)).all();
  let remainingOutstanding = 0;
  let allPaid = true;

  for (const row of updatedSchedule) {
    const ob = row.totalCents + row.penaltyCents;
    const rem = ob - row.paidCents;
    if (rem > 0) {
      remainingOutstanding += rem;
      allPaid = false;
    }
  }

  const newStatus = allPaid ? 'closed' : 'disbursed';
  await db.update(loans)
    .set({
      outstandingCents: Math.max(0, remainingOutstanding),
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(loans.id, loanId));

  const updatedLoan = await db.select().from(loans).where(eq(loans.id, loanId)).get();
  const repayment = await db.select().from(loanRepayments).where(eq(loanRepayments.id, insertedRepayment!.id)).get();

  return {
    repayment: repayment!,
    loan: updatedLoan!,
    allocations: result.allocations,
  };
}

export async function getLoanDetails(db: Db, loanId: number) {
  const loan = await db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (!loan) return null;

  const member = await db.select().from(members).where(eq(members.id, loan.memberId)).get();
  const product = await db.select().from(loanProducts).where(eq(loanProducts.id, loan.productId)).get();
  const schedule = await db.select().from(loanSchedule).where(eq(loanSchedule.loanId, loanId)).orderBy(loanSchedule.installmentNo).all();
  const repayments = await db.select().from(loanRepayments).where(eq(loanRepayments.id, loanId)).orderBy(desc(loanRepayments.paidAt)).all();

  return {
    loan,
    member: member!,
    product: product!,
    schedule,
    repayments,
  };
}

export async function listLoans(
  db: Db,
  options: { status?: string; memberId?: number } = {},
) {
  const conditions = [];
  if (options.status && options.status !== 'all') {
    conditions.push(eq(loans.status, options.status as any));
  }
  if (options.memberId) {
    conditions.push(eq(loans.memberId, options.memberId));
  }

  const query = db
    .select({
      loan: loans,
      memberFirstName: members.firstName,
      memberLastName: members.lastName,
      memberNo: members.memberNo,
      productName: loanProducts.name,
    })
    .from(loans)
    .innerJoin(members, eq(loans.memberId, members.id))
    .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
    .orderBy(desc(loans.appliedAt));

  const rows = conditions.length > 0 ? await query.where(and(...conditions)).all() : await query.all();

  return rows.map((r: any) => ({
    ...r.loan,
    memberName: `${r.memberFirstName} ${r.memberLastName}`,
    memberNo: r.memberNo,
    productName: r.productName,
  }));
}
