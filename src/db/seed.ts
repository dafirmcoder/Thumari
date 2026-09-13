import { config } from '../config.js';
import { createDatabase, applyMigrations } from './index.js';
import { users, contributionTypes, loanProducts } from './schema.js';
import { hashPassword } from '../lib/password.js';

async function seed() {
  console.log('Seeding initial data...');
  const { db } = createDatabase(config.databaseFile);
  await applyMigrations(db);

  // 1. Seed Default Admin User if no users exist
  const existingUsers = await db.select().from(users).all();
  if (existingUsers.length === 0) {
    const passwordHash = await hashPassword('Admin@12345');
    await db.insert(users).values({
      email: 'admin@thumari.local',
      name: 'System Administrator',
      passwordHash,
      role: 'admin',
      status: 'active',
    });
    console.log('Created initial admin account: admin@thumari.local / Admin@12345');
  }

  // 2. Seed Standard Contribution Types
  const existingTypes = await db.select().from(contributionTypes).all();
  if (existingTypes.length === 0) {
    await db.insert(contributionTypes).values([
      {
        name: 'Monthly Savings',
        kind: 'savings',
        defaultAmountCents: 5000000, // 50,000 TSh
        frequency: 'monthly',
        active: true,
      },
      {
        name: 'Welfare Fund',
        kind: 'welfare',
        defaultAmountCents: 1000000, // 10,000 TSh
        frequency: 'monthly',
        active: true,
      },
      {
        name: 'Share Capital',
        kind: 'shares',
        defaultAmountCents: 20000000, // 200,000 TSh
        frequency: 'one_off',
        active: true,
      },
      {
        name: 'Emergency / Social Fund',
        kind: 'social',
        defaultAmountCents: 500000, // 5,000 TSh
        frequency: 'monthly',
        active: true,
      },
    ]);
    console.log('Seeded default contribution types.');
  }

  // 3. Seed Standard Loan Products
  const existingProducts = await db.select().from(loanProducts).all();
  if (existingProducts.length === 0) {
    await db.insert(loanProducts).values([
      {
        name: 'Normal Development Loan',
        interestRateBps: 150, // 1.5% per month reducing
        interestMethod: 'reducing',
        minAmountCents: 10000000, // 100,000 TSh
        maxAmountCents: 1000000000, // 10,000,000 TSh
        minTermMonths: 3,
        maxTermMonths: 24,
        penaltyRateBps: 200, // 2% per month
        graceDays: 5,
        requiresGuarantors: true,
        guarantorsRequired: 2,
        maxMultipleOfSavings: 3,
        active: true,
      },
      {
        name: 'Emergency Loan',
        interestRateBps: 200, // 2% per month flat
        interestMethod: 'flat',
        minAmountCents: 5000000, // 50,000 TSh
        maxAmountCents: 100000000, // 1,000,000 TSh
        minTermMonths: 1,
        maxTermMonths: 6,
        penaltyRateBps: 300,
        graceDays: 3,
        requiresGuarantors: false,
        guarantorsRequired: 0,
        maxMultipleOfSavings: 2,
        active: true,
      },
    ]);
    console.log('Seeded standard loan products.');
  }

  console.log('Seed completed successfully.');
}

seed().catch(console.error);
