export interface OrgConfig {
  name: string;
  shortName: string;
  tagline: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
}

export const config: { org: OrgConfig } = {
  org: {
    name: "Thumari Men's Association",
    shortName: 'Thumari',
    tagline: 'Group Savings, Coffee Produce & Loan Management',
    currency: 'KES',
    currencySymbol: 'KES',
    locale: 'en-KE',
    timezone: 'Africa/Nairobi',
  },
};
