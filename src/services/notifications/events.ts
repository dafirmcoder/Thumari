export interface NotificationEventSpec {
  key: string;
  label: string;
  description: string;
  category: 'contributions' | 'loans' | 'meetings' | 'fines' | 'system';
  defaultAudience: 'member' | 'officers' | 'admins' | 'all';
  userConfigurable: boolean;
  defaultEnabled: boolean;
  priority: 'normal' | 'high';
  broadcastable?: boolean;
}

export const NOTIFICATION_EVENTS: readonly NotificationEventSpec[] = [
  // Contributions
  {
    key: 'contribution.recorded',
    label: 'Contribution Received',
    description: 'Sent to member when a savings or welfare contribution is recorded.',
    category: 'contributions',
    defaultAudience: 'member',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
  },
  {
    key: 'contribution.reminder',
    label: 'Monthly Contribution Reminder',
    description: 'Upcoming monthly contribution due date reminder.',
    category: 'contributions',
    defaultAudience: 'member',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
  },

  // Loans
  {
    key: 'loan.application.received',
    label: 'New Loan Application',
    description: 'Sent to SACCO officers when a member submits a loan application.',
    category: 'loans',
    defaultAudience: 'officers',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'high',
  },
  {
    key: 'loan.approved',
    label: 'Loan Approved',
    description: 'Sent to member when their loan application has been approved.',
    category: 'loans',
    defaultAudience: 'member',
    userConfigurable: false, // Critical transaction
    defaultEnabled: true,
    priority: 'high',
  },
  {
    key: 'loan.rejected',
    label: 'Loan Rejected',
    description: 'Sent to member if a loan application is declined.',
    category: 'loans',
    defaultAudience: 'member',
    userConfigurable: false,
    defaultEnabled: true,
    priority: 'high',
  },
  {
    key: 'loan.disbursed',
    label: 'Loan Disbursed',
    description: 'Sent to member when loan funds have been disbursed.',
    category: 'loans',
    defaultAudience: 'member',
    userConfigurable: false,
    defaultEnabled: true,
    priority: 'high',
  },
  {
    key: 'loan.installment.due',
    label: 'Loan Installment Due',
    description: 'Reminder sent a few days before an installment due date.',
    category: 'loans',
    defaultAudience: 'member',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
  },
  {
    key: 'loan.installment.overdue',
    label: 'Loan Installment Overdue',
    description: 'Urgent notice when an installment is in arrears.',
    category: 'loans',
    defaultAudience: 'member',
    userConfigurable: false,
    defaultEnabled: true,
    priority: 'high',
  },
  {
    key: 'loan.repayment.received',
    label: 'Loan Repayment Receipt',
    description: 'Sent to member when an installment payment is credited.',
    category: 'loans',
    defaultAudience: 'member',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
  },

  // Meetings
  {
    key: 'meeting.scheduled',
    label: 'Meeting Notice',
    description: 'Sent to all members when a new SACCO meeting is scheduled.',
    category: 'meetings',
    defaultAudience: 'all',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
  },
  {
    key: 'meeting.reminder',
    label: 'Meeting Reminder',
    description: 'Sent 24 hours prior to a scheduled meeting.',
    category: 'meetings',
    defaultAudience: 'all',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
  },

  // Fines
  {
    key: 'fine.issued',
    label: 'Fine Notice',
    description: 'Sent to member when an absence or penalty fine is issued.',
    category: 'fines',
    defaultAudience: 'member',
    userConfigurable: false,
    defaultEnabled: true,
    priority: 'high',
  },

  // System & Broadcasts
  {
    key: 'system.announcement',
    label: 'General Announcement',
    description: 'General group broadcasts and announcements from administrators.',
    category: 'system',
    defaultAudience: 'all',
    userConfigurable: true,
    defaultEnabled: true,
    priority: 'normal',
    broadcastable: true,
  },
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]['key'];

export function getEventSpec(key: string): NotificationEventSpec | undefined {
  return NOTIFICATION_EVENTS.find((e) => e.key === key);
}
