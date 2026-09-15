export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'treasurer' | 'secretary' | 'member';
  status: 'active' | 'suspended';
  memberId?: number | null;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Member {
  id: number;
  memberNo: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  nationalId?: string | null;
  photoUrl?: string | null;
  joinDate: string;
  status: 'active' | 'dormant' | 'exited';
  exitDate?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContributionType {
  id: number;
  name: string;
  kind: 'savings' | 'welfare' | 'share_capital' | 'emergency';
  defaultAmountCents: number;
  frequency: 'monthly' | 'one_time' | 'annual';
  active: boolean;
}

export interface Contribution {
  id: number;
  memberId: number;
  typeId: number;
  period?: string | null; // e.g. "2026-03"
  amountCents: number;
  paidAt: string;
  method: 'cash' | 'mpesa' | 'bank';
  reference?: string | null;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: string;
  // Joined fields
  memberName?: string;
  typeName?: string;
}

export interface LoanProduct {
  id: number;
  name: string;
  interestRateBps: number; // e.g. 150 = 1.5% monthly
  interestMethod: 'flat' | 'reducing';
  minAmountCents: number;
  maxAmountCents: number;
  minTermMonths: number;
  maxTermMonths: number;
  penaltyRateBps: number;
  graceDays: number;
  requiresGuarantors: boolean;
  guarantorsRequired: number;
  maxMultipleOfSavings: number;
  active: boolean;
}

export interface Loan {
  id: number;
  loanNo: string;
  memberId: number;
  productId: number;
  principalCents: number;
  interestRateBps: number;
  interestMethod: 'flat' | 'reducing';
  termMonths: number;
  totalInterestCents: number;
  totalPayableCents: number;
  balanceCents: number;
  status: 'pending' | 'approved' | 'disbursed' | 'rejected' | 'completed' | 'defaulted';
  purpose?: string | null;
  appliedAt: string;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  completedAt?: string | null;
  // Joined fields
  memberName?: string;
  productName?: string;
}

export interface LoanRepayment {
  id: number;
  loanId: number;
  amountCents: number;
  principalPaidCents: number;
  interestPaidCents: number;
  penaltyPaidCents: number;
  paidAt: string;
  method: 'cash' | 'mpesa' | 'bank';
  reference?: string | null;
  notes?: string | null;
}

export interface Meeting {
  id: number;
  title: string;
  scheduledAt: string;
  venue?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  status: 'scheduled' | 'in_progress' | 'adjourned' | 'cancelled';
}

export interface MeetingAttendance {
  id: number;
  meetingId: number;
  memberId: number;
  status: 'present' | 'absent' | 'excused';
  notes?: string | null;
}

export interface Fine {
  id: number;
  memberId: number;
  meetingId?: number | null;
  reason: string;
  amountCents: number;
  status: 'unpaid' | 'paid' | 'waived';
  issuedAt: string;
  paidAt?: string | null;
  memberName?: string;
}

export interface Expense {
  id: number;
  category: string;
  amountCents: number;
  description: string;
  receiptUrl?: string | null;
  incurredAt: string;
  recordedBy?: number | null;
  approvedBy?: string | null;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  targetBudgetCents: number;
  currentSpentCents: number;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  startDate?: string | null;
  endDate?: string | null;
}

export interface ProjectIncome {
  id: number;
  projectId: number;
  source: string;
  amountCents: number;
  receivedAt: string;
  reference?: string | null;
  notes?: string | null;
}

export interface CoffeeProduce {
  id: number;
  memberId: number;
  deliveryDate: string;
  receiptNo: string;
  societyName: string;
  factoryName: string;
  growerNo?: string | null;
  grossKg: number;
  tareKg: number;
  netKg: number;
  ratePerKgCents: number;
  payoutCents: number;
  receiptImageUrl?: string | null;
  notes?: string | null;
  verified: boolean;
  memberName?: string;
}

export interface CoffeeRate {
  id: number;
  season: string;
  ratePerKgCents: number;
  effectiveDate: string;
  notes?: string | null;
}

export interface DividendCalculation {
  id: number;
  financialYear: number;
  totalSurplusCents: number;
  dividendPoolCents: number;
  distributionBasis: 'savings' | 'shares' | 'produce';
  totalEligibleSharesOrKg: number;
  declaredAt: string;
  status: 'draft' | 'approved' | 'paid';
}
