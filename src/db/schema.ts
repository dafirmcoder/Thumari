import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const USER_ROLES = ['admin', 'treasurer', 'secretary', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MEMBER_STATUSES = ['active', 'dormant', 'exited'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const CONTRIBUTION_KINDS = ['savings', 'shares', 'welfare', 'social', 'fine'] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export const PAYMENT_METHODS = ['cash', 'mpesa', 'bank', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INTEREST_METHODS = ['flat', 'reducing'] as const;
export type InterestMethod = (typeof INTEREST_METHODS)[number];

export const LOAN_STATUSES = ['pending', 'approved', 'rejected', 'disbursed', 'closed', 'defaulted', 'cancelled'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const INSTALLMENT_STATUSES = ['pending', 'partial', 'paid', 'overdue'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const PUSH_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type PushStatus = (typeof PUSH_STATUSES)[number];

export const MEETING_STATUSES = ['scheduled', 'held', 'cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['present', 'absent', 'excused', 'late'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const FINE_STATUSES = ['outstanding', 'paid', 'waived'] as const;
export type FineStatus = (typeof FINE_STATUSES)[number];

// Users
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: USER_ROLES }).notNull().default('member'),
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  memberId: integer('member_id').references(() => members.id),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

// Sessions
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // SHA-256 hash of random session token
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  ip: text('ip'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_expires_at_idx').on(table.expiresAt),
]);

// Members
export const members = sqliteTable('members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberNo: text('member_no').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  nationalId: text('national_id'),
  joinDate: integer('join_date', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  status: text('status', { enum: MEMBER_STATUSES }).notNull().default('active'),
  exitDate: integer('exit_date', { mode: 'timestamp_ms' }),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('members_status_idx').on(table.status),
]);

// Contribution Types
export const contributionTypes = sqliteTable('contribution_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  kind: text('kind', { enum: CONTRIBUTION_KINDS }).notNull().default('savings'),
  defaultAmountCents: integer('default_amount_cents').notNull().default(0),
  frequency: text('frequency', { enum: ['weekly', 'monthly', 'one_off'] }).notNull().default('monthly'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

// Contributions
export const contributions = sqliteTable('contributions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberId: integer('member_id').notNull().references(() => members.id),
  typeId: integer('type_id').notNull().references(() => contributionTypes.id),
  period: text('period'), // YYYY-MM
  amountCents: integer('amount_cents').notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }).notNull(),
  method: text('method', { enum: PAYMENT_METHODS }).notNull().default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  recordedBy: integer('recorded_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('contributions_member_idx').on(table.memberId),
  index('contributions_period_idx').on(table.period),
  index('contributions_paid_at_idx').on(table.paidAt),
]);

// Loan Products
export const loanProducts = sqliteTable('loan_products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  interestRateBps: integer('interest_rate_bps').notNull().default(500), // Monthly basis points (500 bps = 5%)
  interestMethod: text('interest_method', { enum: INTEREST_METHODS }).notNull().default('reducing'),
  minAmountCents: integer('min_amount_cents').notNull().default(0),
  maxAmountCents: integer('max_amount_cents').notNull().default(0), // 0 = unlimited
  minTermMonths: integer('min_term_months').notNull().default(1),
  maxTermMonths: integer('max_term_months').notNull().default(24),
  penaltyRateBps: integer('penalty_rate_bps').notNull().default(200), // 200 bps = 2% per month
  graceDays: integer('grace_days').notNull().default(5),
  requiresGuarantors: integer('requires_guarantors', { mode: 'boolean' }).notNull().default(false),
  guarantorsRequired: integer('guarantors_required').notNull().default(0),
  maxMultipleOfSavings: integer('max_multiple_of_savings').notNull().default(3), // Max 3x member savings
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

// Loans
export const loans = sqliteTable('loans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanNo: text('loan_no').notNull().unique(),
  memberId: integer('member_id').notNull().references(() => members.id),
  productId: integer('product_id').notNull().references(() => loanProducts.id),
  principalCents: integer('principal_cents').notNull(),
  interestRateBps: integer('interest_rate_bps').notNull(),
  interestMethod: text('interest_method', { enum: INTEREST_METHODS }).notNull(),
  termMonths: integer('term_months').notNull(),
  purpose: text('purpose'),
  status: text('status', { enum: LOAN_STATUSES }).notNull().default('pending'),
  appliedAt: integer('applied_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  decisionBy: integer('decision_by').references(() => users.id),
  decisionAt: integer('decision_at', { mode: 'timestamp_ms' }),
  decisionNotes: text('decision_notes'),
  disbursedAt: integer('disbursed_at', { mode: 'timestamp_ms' }),
  firstDueDate: integer('first_due_date', { mode: 'timestamp_ms' }),
  totalPayableCents: integer('total_payable_cents').notNull().default(0),
  outstandingCents: integer('outstanding_cents').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('loans_member_idx').on(table.memberId),
  index('loans_status_idx').on(table.status),
]);

// Loan Schedule (Installments)
export const loanSchedule = sqliteTable('loan_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  installmentNo: integer('installment_no').notNull(),
  dueDate: integer('due_date', { mode: 'timestamp_ms' }).notNull(),
  principalCents: integer('principal_cents').notNull(),
  interestCents: integer('interest_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  paidCents: integer('paid_cents').notNull().default(0),
  penaltyCents: integer('penalty_cents').notNull().default(0),
  status: text('status', { enum: INSTALLMENT_STATUSES }).notNull().default('pending'),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('loan_installment_unique').on(table.loanId, table.installmentNo),
  index('loan_schedule_due_date_idx').on(table.dueDate),
]);

// Loan Repayments
export const loanRepayments = sqliteTable('loan_repayments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id').notNull().references(() => loans.id),
  memberId: integer('member_id').notNull().references(() => members.id),
  amountCents: integer('amount_cents').notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }).notNull(),
  method: text('method', { enum: PAYMENT_METHODS }).notNull().default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  recordedBy: integer('recorded_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('loan_repayments_loan_idx').on(table.loanId),
  index('loan_repayments_member_idx').on(table.memberId),
]);

// Loan Guarantors
export const loanGuarantors = sqliteTable('loan_guarantors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id),
  amountCents: integer('amount_cents').notNull().default(0),
  status: text('status', { enum: ['pending', 'accepted', 'declined'] }).notNull().default('pending'),
  respondedAt: integer('responded_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('loan_guarantor_unique').on(table.loanId, table.memberId),
  index('loan_guarantor_member_idx').on(table.memberId),
]);

// Meetings
export const meetings = sqliteTable('meetings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
  location: text('location'),
  agenda: text('agenda'),
  status: text('status', { enum: MEETING_STATUSES }).notNull().default('scheduled'),
  minutes: text('minutes'),
  absenceFineCents: integer('absence_fine_cents').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

// Meeting Attendance
export const meetingAttendance = sqliteTable('meeting_attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  meetingId: integer('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id),
  status: text('status', { enum: ATTENDANCE_STATUSES }).notNull().default('absent'),
  fineCents: integer('fine_cents').notNull().default(0),
  recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('meeting_attendance_unique').on(table.meetingId, table.memberId),
]);

// Fines
export const fines = sqliteTable('fines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  memberId: integer('member_id').notNull().references(() => members.id),
  meetingId: integer('meeting_id').references(() => meetings.id),
  reason: text('reason').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status', { enum: FINE_STATUSES }).notNull().default('outstanding'),
  issuedAt: integer('issued_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
  createdBy: integer('created_by').references(() => users.id),
}, (table) => [
  index('fines_member_idx').on(table.memberId),
  index('fines_status_idx').on(table.status),
]);

// Push Subscriptions
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  platform: text('platform'),
  failureCount: integer('failure_count').notNull().default(0),
  disabledAt: integer('disabled_at', { mode: 'timestamp_ms' }),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('push_subscriptions_user_idx').on(table.userId),
]);

// Notification Preferences
export const notificationPreferences = sqliteTable('notification_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventKey: text('event_key').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  uniqueIndex('notification_pref_user_event').on(table.userId, table.eventKey),
]);

// Notifications Inbox & Outbox
export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventKey: text('event_key').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  url: text('url'),
  data: text('data'), // JSON string
  readAt: integer('read_at', { mode: 'timestamp_ms' }),
  pushedAt: integer('pushed_at', { mode: 'timestamp_ms' }),
  pushStatus: text('push_status', { enum: PUSH_STATUSES }).notNull().default('pending'),
  pushError: text('push_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('notifications_user_unread_idx').on(table.userId, table.readAt),
  index('notifications_created_idx').on(table.createdAt),
]);

// Audit Log
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorUserId: integer('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  detail: text('detail'), // JSON string
  ip: text('ip'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('audit_log_entity_idx').on(table.entity, table.entityId),
  index('audit_log_created_idx').on(table.createdAt),
]);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Member = typeof members.$inferSelect;
export type ContributionType = typeof contributionTypes.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type LoanProduct = typeof loanProducts.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type LoanScheduleItem = typeof loanSchedule.$inferSelect;
export type LoanRepayment = typeof loanRepayments.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Fine = typeof fines.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
