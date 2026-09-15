import type {
  User,
  Member,
  ContributionType,
  Contribution,
  LoanProduct,
  Loan,
  LoanRepayment,
  Meeting,
  Fine,
  Expense,
  Project,
  ProjectIncome,
  CoffeeProduce,
  CoffeeRate,
} from '../types.js';
import { computeInstallments, computePenaltyCents, allocatePayment } from '../lib/loan-math.js';

// Initial Seed Data
const INITIAL_USERS: User[] = [
  {
    id: 1,
    email: 'admin@thumari.local',
    name: 'Group Administrator',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    email: 'treasurer@thumari.local',
    name: 'Chama Treasurer',
    role: 'treasurer',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const INITIAL_MEMBERS: Member[] = [
  {
    id: 1,
    memberNo: 'M-0001',
    firstName: 'John',
    lastName: 'Maina',
    phone: '+254 712 345 678',
    email: 'john.maina@thumari.local',
    nationalId: '24110022',
    joinDate: '2024-01-15',
    status: 'active',
    notes: 'Founding member and coffee farmer at Kii Factory.',
  },
  {
    id: 2,
    memberNo: 'M-0002',
    firstName: 'Emmanuel',
    lastName: 'Kiprop',
    phone: '+254 722 987 654',
    email: 'emmanuel.kiprop@thumari.local',
    nationalId: '29881100',
    joinDate: '2024-01-15',
    status: 'active',
    notes: 'Member of loan committee.',
  },
  {
    id: 3,
    memberNo: 'M-0003',
    firstName: 'Sarah',
    lastName: 'Cherono',
    phone: '+254 733 112 233',
    email: 'sarah.cherono@thumari.local',
    nationalId: '31554422',
    joinDate: '2024-02-01',
    status: 'active',
    notes: 'Active contributor.',
  },
  {
    id: 4,
    memberNo: 'M-0004',
    firstName: 'Peter',
    lastName: 'Mwangi',
    phone: '+254 744 445 566',
    email: 'peter.mwangi@thumari.local',
    nationalId: '20993311',
    joinDate: '2024-02-15',
    status: 'active',
  },
  {
    id: 5,
    memberNo: 'M-0005',
    firstName: 'Grace',
    lastName: 'Wanjiku',
    phone: '+254 755 778 899',
    email: 'grace.wanjiku@thumari.local',
    nationalId: '28445566',
    joinDate: '2024-03-01',
    status: 'active',
  },
];

const INITIAL_CONTRIBUTION_TYPES: ContributionType[] = [
  {
    id: 1,
    name: 'Monthly Savings',
    kind: 'savings',
    defaultAmountCents: 500000, // 5,000 KES
    frequency: 'monthly',
    active: true,
  },
  {
    id: 2,
    name: 'Welfare Fund',
    kind: 'welfare',
    defaultAmountCents: 100000, // 1,000 KES
    frequency: 'monthly',
    active: true,
  },
  {
    id: 3,
    name: 'Share Capital',
    kind: 'share_capital',
    defaultAmountCents: 2000000, // 20,000 KES
    frequency: 'one_time',
    active: true,
  },
  {
    id: 4,
    name: 'Emergency Fund',
    kind: 'emergency',
    defaultAmountCents: 50000, // 500 KES
    frequency: 'monthly',
    active: true,
  },
];

const INITIAL_CONTRIBUTIONS: Contribution[] = [
  {
    id: 1,
    memberId: 1,
    typeId: 1,
    period: '2026-01',
    amountCents: 500000,
    paidAt: '2026-01-05T09:30:00Z',
    method: 'mpesa',
    reference: 'QA12345678',
    notes: 'January savings',
    createdAt: '2026-01-05T09:30:00Z',
  },
  {
    id: 2,
    memberId: 2,
    typeId: 1,
    period: '2026-01',
    amountCents: 500000,
    paidAt: '2026-01-06T10:15:00Z',
    method: 'mpesa',
    reference: 'QA12345679',
    notes: 'January savings',
    createdAt: '2026-01-06T10:15:00Z',
  },
  {
    id: 3,
    memberId: 3,
    typeId: 1,
    period: '2026-01',
    amountCents: 500000,
    paidAt: '2026-01-07T11:00:00Z',
    method: 'cash',
    reference: 'REC-001',
    createdAt: '2026-01-07T11:00:00Z',
  },
  {
    id: 4,
    memberId: 1,
    typeId: 1,
    period: '2026-02',
    amountCents: 500000,
    paidAt: '2026-02-04T08:45:00Z',
    method: 'mpesa',
    reference: 'QB23456789',
    createdAt: '2026-02-04T08:45:00Z',
  },
  {
    id: 5,
    memberId: 2,
    typeId: 1,
    period: '2026-02',
    amountCents: 500000,
    paidAt: '2026-02-05T14:20:00Z',
    method: 'mpesa',
    reference: 'QB23456790',
    createdAt: '2026-02-05T14:20:00Z',
  },
  {
    id: 6,
    memberId: 4,
    typeId: 1,
    period: '2026-02',
    amountCents: 500000,
    paidAt: '2026-02-07T16:00:00Z',
    method: 'cash',
    reference: 'REC-002',
    createdAt: '2026-02-07T16:00:00Z',
  },
  {
    id: 7,
    memberId: 5,
    typeId: 1,
    period: '2026-02',
    amountCents: 500000,
    paidAt: '2026-02-08T12:30:00Z',
    method: 'mpesa',
    reference: 'QB23456791',
    createdAt: '2026-02-08T12:30:00Z',
  },
];

const INITIAL_LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 1,
    name: 'Normal Development Loan',
    interestRateBps: 150, // 1.5% per month
    interestMethod: 'reducing',
    minAmountCents: 1000000, // 10,000 KES
    maxAmountCents: 100000000, // 1,000,000 KES
    minTermMonths: 3,
    maxTermMonths: 24,
    penaltyRateBps: 200,
    graceDays: 5,
    requiresGuarantors: true,
    guarantorsRequired: 2,
    maxMultipleOfSavings: 3,
    active: true,
  },
  {
    id: 2,
    name: 'Emergency Loan',
    interestRateBps: 200, // 2% per month
    interestMethod: 'flat',
    minAmountCents: 500000, // 5,000 KES
    maxAmountCents: 20000000, // 200,000 KES
    minTermMonths: 1,
    maxTermMonths: 6,
    penaltyRateBps: 250,
    graceDays: 3,
    requiresGuarantors: false,
    guarantorsRequired: 0,
    maxMultipleOfSavings: 2,
    active: true,
  },
  {
    id: 3,
    name: 'School Fees Loan',
    interestRateBps: 100, // 1.0% per month
    interestMethod: 'reducing',
    minAmountCents: 1000000,
    maxAmountCents: 50000000,
    minTermMonths: 3,
    maxTermMonths: 12,
    penaltyRateBps: 150,
    graceDays: 5,
    requiresGuarantors: true,
    guarantorsRequired: 1,
    maxMultipleOfSavings: 3,
    active: true,
  },
];

const INITIAL_LOANS: Loan[] = [
  {
    id: 1,
    loanNo: 'LN-2026-0001',
    memberId: 1,
    productId: 1,
    principalCents: 20000000, // 200,000 KES
    interestRateBps: 150,
    interestMethod: 'reducing',
    termMonths: 12,
    totalInterestCents: 1980000,
    totalPayableCents: 21980000,
    balanceCents: 18316667,
    status: 'disbursed',
    purpose: 'Farm expansion and coffee seedling purchase',
    appliedAt: '2026-01-10T10:00:00Z',
    approvedAt: '2026-01-12T14:00:00Z',
    disbursedAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 2,
    loanNo: 'LN-2026-0002',
    memberId: 2,
    productId: 2,
    principalCents: 5000000, // 50,000 KES
    interestRateBps: 200,
    interestMethod: 'flat',
    termMonths: 3,
    totalInterestCents: 300000,
    totalPayableCents: 5300000,
    balanceCents: 0,
    status: 'completed',
    purpose: 'Medical emergency',
    appliedAt: '2026-01-05T08:00:00Z',
    approvedAt: '2026-01-05T12:00:00Z',
    disbursedAt: '2026-01-06T10:00:00Z',
    completedAt: '2026-03-01T15:00:00Z',
  },
  {
    id: 3,
    loanNo: 'LN-2026-0003',
    memberId: 3,
    productId: 3,
    principalCents: 10000000, // 100,000 KES
    interestRateBps: 100,
    interestMethod: 'reducing',
    termMonths: 6,
    totalInterestCents: 350000,
    totalPayableCents: 10350000,
    balanceCents: 10350000,
    status: 'pending',
    purpose: 'Term 1 Secondary school fees',
    appliedAt: '2026-03-10T11:00:00Z',
  },
];

const INITIAL_COFFEE_RATES: CoffeeRate[] = [
  {
    id: 1,
    season: '2025/2026 Main Crop',
    ratePerKgCents: 12000, // 120.00 KES per kg
    effectiveDate: '2025-10-01',
    notes: 'Premium SL28 and Ruiru 11 cherry payment rate',
  },
  {
    id: 2,
    season: '2025/2026 Early Crop',
    ratePerKgCents: 9500, // 95.00 KES per kg
    effectiveDate: '2025-05-01',
    notes: 'Fly crop delivery rate',
  },
];

const INITIAL_COFFEE_PRODUCE: CoffeeProduce[] = [
  {
    id: 1,
    memberId: 1,
    deliveryDate: '2026-02-14',
    receiptNo: 'RCP-KII-8492',
    societyName: "Rung'eto Farmers Co-op Society",
    factoryName: 'Kii Factory',
    growerNo: 'FCS-0142',
    grossKg: 345.5,
    tareKg: 5.5,
    netKg: 340.0,
    ratePerKgCents: 12000,
    payoutCents: 4080000, // 40,800 KES
    receiptImageUrl: null,
    notes: 'AA grade ripe cherries',
    verified: true,
  },
  {
    id: 2,
    memberId: 2,
    deliveryDate: '2026-02-18',
    receiptNo: 'RCP-KII-8519',
    societyName: "Rung'eto Farmers Co-op Society",
    factoryName: 'Kii Factory',
    growerNo: 'FCS-0288',
    grossKg: 512.0,
    tareKg: 6.0,
    netKg: 506.0,
    ratePerKgCents: 12000,
    payoutCents: 6072000, // 60,720 KES
    receiptImageUrl: null,
    notes: 'Delivered in afternoon batch',
    verified: true,
  },
  {
    id: 3,
    memberId: 4,
    deliveryDate: '2026-02-22',
    receiptNo: 'RCP-GON-4102',
    societyName: 'Baragwi Farmers Co-op Society',
    factoryName: 'Gondo Factory',
    growerNo: 'FCS-0912',
    grossKg: 280.0,
    tareKg: 4.0,
    netKg: 276.0,
    ratePerKgCents: 12000,
    payoutCents: 3312000,
    verified: true,
  },
];

const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 1,
    title: 'February 2026 Monthly General Meeting',
    scheduledAt: '2026-02-15T14:00:00Z',
    venue: 'Community Social Hall, Kerugoya',
    agenda: '1. Review of savings ledger\n2. Loan applications appraisal\n3. Coffee harvest season report',
    minutes: 'Meeting resolved to approve John Maina farm loan and set dividend calculation date for April.',
    status: 'adjourned',
  },
  {
    id: 2,
    title: 'March 2026 Monthly General Meeting',
    scheduledAt: '2026-03-20T14:00:00Z',
    venue: 'Community Social Hall, Kerugoya',
    agenda: '1. Annual audit report presentation\n2. Dividend distribution proposal\n3. New member inductions',
    status: 'scheduled',
  },
];

const INITIAL_FINES: Fine[] = [
  {
    id: 1,
    memberId: 4,
    meetingId: 1,
    reason: 'Unexcused absence from Feb 2026 general meeting',
    amountCents: 50000, // 500 KES
    status: 'unpaid',
    issuedAt: '2026-02-15T16:00:00Z',
  },
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 1,
    category: 'Hall Rental',
    amountCents: 300000, // 3,000 KES
    description: 'Meeting hall booking for February AGM',
    incurredAt: '2026-02-14T10:00:00Z',
    approvedBy: 'Group Administrator',
  },
  {
    id: 2,
    category: 'Stationery & Printing',
    amountCents: 150000, // 1,500 KES
    description: 'Passbooks and contribution receipt vouchers',
    incurredAt: '2026-02-10T11:30:00Z',
    approvedBy: 'Chama Treasurer',
  },
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Chama Commercial Plot Acquisition',
    description: 'Purchase of 1/4 acre commercial plot along Kerugoya - Kutus highway for member asset growth.',
    targetBudgetCents: 150000000, // 1,500,000 KES
    currentSpentCents: 85000000, // 850,000 KES
    status: 'active',
    startDate: '2025-06-01',
    endDate: '2026-12-31',
  },
];

const STORAGE_KEY = 'thumari_pwa_data_v1';

class AppStore {
  private members: Member[] = [];
  private contributionTypes: ContributionType[] = [];
  private contributions: Contribution[] = [];
  private loanProducts: LoanProduct[] = [];
  private loans: Loan[] = [];
  private coffeeRates: CoffeeRate[] = [];
  private coffeeProduce: CoffeeProduce[] = [];
  private meetings: Meeting[] = [];
  private fines: Fine[] = [];
  private expenses: Expense[] = [];
  private projects: Project[] = [];
  private currentUser: User | null = null;
  private listeners: (() => void)[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          this.members = data.members ?? INITIAL_MEMBERS;
          this.contributionTypes = data.contributionTypes ?? INITIAL_CONTRIBUTION_TYPES;
          this.contributions = data.contributions ?? INITIAL_CONTRIBUTIONS;
          this.loanProducts = data.loanProducts ?? INITIAL_LOAN_PRODUCTS;
          this.loans = data.loans ?? INITIAL_LOANS;
          this.coffeeRates = data.coffeeRates ?? INITIAL_COFFEE_RATES;
          this.coffeeProduce = data.coffeeProduce ?? INITIAL_COFFEE_PRODUCE;
          this.meetings = data.meetings ?? INITIAL_MEETINGS;
          this.fines = data.fines ?? INITIAL_FINES;
          this.expenses = data.expenses ?? INITIAL_EXPENSES;
          this.projects = data.projects ?? INITIAL_PROJECTS;
          this.currentUser = data.currentUser ?? INITIAL_USERS[0];
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
    this.resetToDefaults();
  }

  private save() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const data = {
          members: this.members,
          contributionTypes: this.contributionTypes,
          contributions: this.contributions,
          loanProducts: this.loanProducts,
          loans: this.loans,
          coffeeRates: this.coffeeRates,
          coffeeProduce: this.coffeeProduce,
          meetings: this.meetings,
          fines: this.fines,
          expenses: this.expenses,
          projects: this.projects,
          currentUser: this.currentUser,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    this.notify();
  }


  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public resetToDefaults() {
    this.members = [...INITIAL_MEMBERS];
    this.contributionTypes = [...INITIAL_CONTRIBUTION_TYPES];
    this.contributions = [...INITIAL_CONTRIBUTIONS];
    this.loanProducts = [...INITIAL_LOAN_PRODUCTS];
    this.loans = [...INITIAL_LOANS];
    this.coffeeRates = [...INITIAL_COFFEE_RATES];
    this.coffeeProduce = [...INITIAL_COFFEE_PRODUCE];
    this.meetings = [...INITIAL_MEETINGS];
    this.fines = [...INITIAL_FINES];
    this.expenses = [...INITIAL_EXPENSES];
    this.projects = [...INITIAL_PROJECTS];
    this.currentUser = INITIAL_USERS[0] ?? null;
    this.save();
  }

  // Auth
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public login(email: string): boolean {
    const user = INITIAL_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || {
      id: Date.now(),
      email,
      name: email.split('@')[0] ?? 'User',
      role: 'admin' as const,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };
    this.currentUser = user;
    this.save();
    return true;
  }

  public logout() {
    this.currentUser = null;
    this.save();
  }

  // Members
  public getMembers(): Member[] {
    return [...this.members];
  }

  public getMemberById(id: number): Member | undefined {
    return this.members.find((m) => m.id === id);
  }

  public addMember(memberData: Omit<Member, 'id' | 'memberNo'>): Member {
    const nextId = this.members.length > 0 ? Math.max(...this.members.map((m) => m.id)) + 1 : 1;
    const memberNo = `M-${nextId.toString().padStart(4, '0')}`;
    const newMember: Member = {
      ...memberData,
      id: nextId,
      memberNo,
    };
    this.members.push(newMember);
    this.save();
    return newMember;
  }

  public updateMember(id: number, updates: Partial<Member>): Member | undefined {
    const idx = this.members.findIndex((m) => m.id === id);
    if (idx !== -1 && this.members[idx]) {
      this.members[idx] = { ...this.members[idx], ...updates };
      this.save();
      return this.members[idx];
    }
    return undefined;
  }

  // Contributions
  public getContributions(): Contribution[] {
    return this.contributions
      .map((c) => {
        const member = this.getMemberById(c.memberId);
        const type = this.contributionTypes.find((t) => t.id === c.typeId);
        return {
          ...c,
          memberName: member ? `${member.firstName} ${member.lastName}` : `Member #${c.memberId}`,
          typeName: type?.name ?? 'Contribution',
        };
      })
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }

  public getContributionTypes(): ContributionType[] {
    return [...this.contributionTypes];
  }

  public addContribution(data: Omit<Contribution, 'id' | 'createdAt'>): Contribution {
    const nextId = this.contributions.length > 0 ? Math.max(...this.contributions.map((c) => c.id)) + 1 : 1;
    const newContribution: Contribution = {
      ...data,
      id: nextId,
      createdAt: new Date().toISOString(),
    };
    this.contributions.push(newContribution);
    this.save();
    return newContribution;
  }

  // Loans
  public getLoanProducts(): LoanProduct[] {
    return [...this.loanProducts];
  }

  public getLoans(): Loan[] {
    return this.loans
      .map((l) => {
        const member = this.getMemberById(l.memberId);
        const product = this.loanProducts.find((p) => p.id === l.productId);
        return {
          ...l,
          memberName: member ? `${member.firstName} ${member.lastName}` : `Member #${l.memberId}`,
          productName: product?.name ?? 'Standard Loan',
        };
      })
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  public addLoan(data: {
    memberId: number;
    productId: number;
    principalCents: number;
    termMonths: number;
    purpose?: string;
  }): Loan {
    const product = this.loanProducts.find((p) => p.id === data.productId) ?? this.loanProducts[0]!;
    const math = computeInstallments({
      principalCents: data.principalCents,
      monthlyRateBps: product.interestRateBps,
      method: product.interestMethod,
      termMonths: data.termMonths,
    });

    const nextId = this.loans.length > 0 ? Math.max(...this.loans.map((l) => l.id)) + 1 : 1;
    const loanNo = `LN-2026-${nextId.toString().padStart(4, '0')}`;
    const newLoan: Loan = {
      id: nextId,
      loanNo,
      memberId: data.memberId,
      productId: data.productId,
      principalCents: data.principalCents,
      interestRateBps: product.interestRateBps,
      interestMethod: product.interestMethod,
      termMonths: data.termMonths,
      totalInterestCents: math.totalInterestCents,
      totalPayableCents: math.totalPayableCents,
      balanceCents: math.totalPayableCents,
      status: 'pending',
      purpose: data.purpose ?? null,
      appliedAt: new Date().toISOString(),
    };

    this.loans.push(newLoan);
    this.save();
    return newLoan;
  }

  public updateLoanStatus(
    id: number,
    status: Loan['status'],
    details?: { disbursedAt?: string; approvedAt?: string },
  ) {
    const loan = this.loans.find((l) => l.id === id);
    if (loan) {
      loan.status = status;
      if (details?.approvedAt) loan.approvedAt = details.approvedAt;
      if (details?.disbursedAt) loan.disbursedAt = details.disbursedAt;
      this.save();
    }
  }

  public recordLoanRepayment(loanId: number, amountCents: number): boolean {
    const loan = this.loans.find((l) => l.id === loanId);
    if (!loan) return false;

    loan.balanceCents = Math.max(0, loan.balanceCents - amountCents);
    if (loan.balanceCents === 0) {
      loan.status = 'completed';
      loan.completedAt = new Date().toISOString();
    }
    this.save();
    return true;
  }

  // Coffee Produce
  public getCoffeeProduce(): CoffeeProduce[] {
    return this.coffeeProduce
      .map((p) => {
        const member = this.getMemberById(p.memberId);
        return {
          ...p,
          memberName: member ? `${member.firstName} ${member.lastName}` : `Member #${p.memberId}`,
        };
      })
      .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());
  }

  public getCoffeeRates(): CoffeeRate[] {
    return [...this.coffeeRates];
  }

  public addCoffeeProduce(produceData: Omit<CoffeeProduce, 'id'>): CoffeeProduce {
    const nextId = this.coffeeProduce.length > 0 ? Math.max(...this.coffeeProduce.map((p) => p.id)) + 1 : 1;
    const item: CoffeeProduce = {
      ...produceData,
      id: nextId,
    };
    this.coffeeProduce.push(item);
    this.save();
    return item;
  }

  // Meetings
  public getMeetings(): Meeting[] {
    return [...this.meetings].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );
  }

  public addMeeting(data: Omit<Meeting, 'id'>): Meeting {
    const nextId = this.meetings.length > 0 ? Math.max(...this.meetings.map((m) => m.id)) + 1 : 1;
    const meeting: Meeting = { ...data, id: nextId };
    this.meetings.push(meeting);
    this.save();
    return meeting;
  }

  // Fines
  public getFines(): Fine[] {
    return this.fines.map((f) => {
      const member = this.getMemberById(f.memberId);
      return {
        ...f,
        memberName: member ? `${member.firstName} ${member.lastName}` : `Member #${f.memberId}`,
      };
    });
  }

  public payFine(id: number) {
    const fine = this.fines.find((f) => f.id === id);
    if (fine) {
      fine.status = 'paid';
      fine.paidAt = new Date().toISOString();
      this.save();
    }
  }

  // Expenses
  public getExpenses(): Expense[] {
    return [...this.expenses].sort((a, b) => new Date(b.incurredAt).getTime() - new Date(a.incurredAt).getTime());
  }

  public addExpense(data: Omit<Expense, 'id'>): Expense {
    const nextId = this.expenses.length > 0 ? Math.max(...this.expenses.map((e) => e.id)) + 1 : 1;
    const exp: Expense = { ...data, id: nextId };
    this.expenses.push(exp);
    this.save();
    return exp;
  }

  // Projects
  public getProjects(): Project[] {
    return [...this.projects];
  }

  public addProject(data: Omit<Project, 'id' | 'currentSpentCents'>): Project {
    const nextId = this.projects.length > 0 ? Math.max(...this.projects.map((p) => p.id)) + 1 : 1;
    const project: Project = { ...data, id: nextId, currentSpentCents: 0 };
    this.projects.push(project);
    this.save();
    return project;
  }

  // KPIs
  public getKPIs() {
    const activeMemberCount = this.members.filter((m) => m.status === 'active').length;
    const totalSavingsCents = this.contributions
      .filter((c) => {
        const type = this.contributionTypes.find((t) => t.id === c.typeId);
        return type?.kind === 'savings';
      })
      .reduce((sum, c) => sum + c.amountCents, 0);

    const activeLoans = this.loans.filter((l) => l.status === 'disbursed');
    const totalOutstandingLoanCents = activeLoans.reduce((sum, l) => sum + l.balanceCents, 0);

    const totalCoffeeKg = this.coffeeProduce.reduce((sum, p) => sum + p.netKg, 0);
    const totalCoffeePayoutCents = this.coffeeProduce.reduce((sum, p) => sum + p.payoutCents, 0);

    const overdueInstallmentCents = this.fines
      .filter((f) => f.status === 'unpaid')
      .reduce((sum, f) => sum + f.amountCents, 0);

    return {
      activeMemberCount,
      totalSavingsCents,
      totalOutstandingLoanCents,
      overdueInstallmentCents,
      totalCoffeeKg,
      totalCoffeePayoutCents,
    };
  }
}

export const store = new AppStore();
