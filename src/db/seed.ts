import { config } from '../config.js';
import { createDatabase, applyMigrations } from './index.js';
import {
  users,
  members,
  contributionTypes,
  contributions,
  loanProducts,
  loans,
  loanSchedule,
  loanRepayments,
  meetings,
  meetingAttendance,
  notifications,
  coffeeProduce,
} from './schema.js';
import { hashPassword } from '../lib/password.js';
import { computeInstallments } from '../lib/loan-math.js';
import { installmentDueDate } from '../lib/dates.js';

async function seed() {
  console.log('Seeding rich demo data for Thumari Men\'s Association (Kirinyaga County)...');
  const { db } = createDatabase(config.databaseFile);
  await applyMigrations(db);

  const defaultPasswordHash = await hashPassword('Admin@12345');
  const memberPasswordHash = await hashPassword('Member@12345');

  // 1. Seed Demo Members
  const existingMembers = await db.select().from(members).all();
  if (existingMembers.length === 0) {
    const sampleMembers = [
      {
        memberNo: 'M-0001',
        firstName: 'John',
        lastName: 'Maina',
        phone: '+254 712 345 678',
        email: 'john.maina@thumari.local',
        nationalId: '24110022',
        status: 'active' as const,
      },
      {
        memberNo: 'M-0002',
        firstName: 'Emmanuel',
        lastName: 'Kiprop',
        phone: '+254 722 987 654',
        email: 'emmanuel.kiprop@thumari.local',
        nationalId: '29881100',
        status: 'active' as const,
      },
      {
        memberNo: 'M-0003',
        firstName: 'Sarah',
        lastName: 'Cherono',
        phone: '+254 733 112 233',
        email: 'sarah.cherono@thumari.local',
        nationalId: '31554422',
        status: 'active' as const,
      },
      {
        memberNo: 'M-0004',
        firstName: 'Peter',
        lastName: 'Mwangi',
        phone: '+254 744 445 566',
        email: 'peter.mwangi@thumari.local',
        nationalId: '20993311',
        status: 'active' as const,
      },
      {
        memberNo: 'M-0005',
        firstName: 'Grace',
        lastName: 'Wanjiku',
        phone: '+254 755 778 899',
        email: 'grace.wanjiku@thumari.local',
        nationalId: '28445566',
        status: 'active' as const,
      },
    ];

    for (const m of sampleMembers) {
      await db.insert(members).values({
        ...m,
        joinDate: new Date('2024-01-15'),
      });
    }
    console.log('Seeded 5 demo members.');
  }

  const allMembers = await db.select().from(members).all();
  const m1 = allMembers[0]!;
  const m2 = allMembers[1]!;
  const m3 = allMembers[2]!;
  const m4 = allMembers[3]!;
  const m5 = allMembers[4]!;

  // 2. Seed Officers & Users
  const existingUsers = await db.select().from(users).all();
  let adminUser = existingUsers.find((u) => u.role === 'admin');
  if (!adminUser) {
    const [inserted] = await db.insert(users).values([
      {
        email: 'admin@thumari.local',
        name: 'System Administrator',
        passwordHash: defaultPasswordHash,
        role: 'admin',
        status: 'active',
        memberId: m1.id,
      },
      {
        email: 'emmanuel.kiprop@thumari.local',
        name: 'Emmanuel Kiprop (Treasurer)',
        passwordHash: memberPasswordHash,
        role: 'treasurer',
        status: 'active',
        memberId: m2.id,
      },
      {
        email: 'sarah.cherono@thumari.local',
        name: 'Sarah Cherono',
        passwordHash: memberPasswordHash,
        role: 'member',
        status: 'active',
        memberId: m3.id,
      },
    ]).returning();
    adminUser = inserted;
    console.log('Created admin and officer accounts.');
  }

  // 3. Seed Contribution Types in KES
  const existingTypes = await db.select().from(contributionTypes).all();
  if (existingTypes.length === 0) {
    await db.insert(contributionTypes).values([
      {
        name: 'Monthly Savings',
        kind: 'savings',
        defaultAmountCents: 200000, // KES 2,000
        frequency: 'monthly',
        active: true,
      },
      {
        name: 'Welfare Fund',
        kind: 'welfare',
        defaultAmountCents: 50000, // KES 500
        frequency: 'monthly',
        active: true,
      },
      {
        name: 'Share Capital',
        kind: 'shares',
        defaultAmountCents: 1000000, // KES 10,000
        frequency: 'one_off',
        active: true,
      },
      {
        name: 'Emergency / Social Fund',
        kind: 'social',
        defaultAmountCents: 30000, // KES 300
        frequency: 'monthly',
        active: true,
      },
      {
        name: 'Coffee Produce Levy',
        kind: 'savings',
        defaultAmountCents: 20000, // KES 200
        frequency: 'monthly',
        active: true,
      },
    ]);
  }
  const allTypes = await db.select().from(contributionTypes).all();
  const savingsType = allTypes.find((t) => t.name === 'Monthly Savings')!;
  const welfareType = allTypes.find((t) => t.name === 'Welfare Fund')!;
  const shareType = allTypes.find((t) => t.name === 'Share Capital')!;
  const socialType = allTypes.find((t) => t.name.includes('Social'))!;

  // 4. Seed Standard Loan Products in KES
  const existingProducts = await db.select().from(loanProducts).all();
  if (existingProducts.length === 0) {
    await db.insert(loanProducts).values([
      {
        name: 'Normal Development Loan',
        interestRateBps: 150, // 1.5% per month reducing
        interestMethod: 'reducing',
        minAmountCents: 1000000, // KES 10,000
        maxAmountCents: 50000000, // KES 500,000
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
        name: 'Emergency / Farm Input Loan',
        interestRateBps: 200, // 2% per month flat
        interestMethod: 'flat',
        minAmountCents: 500000, // KES 5,000
        maxAmountCents: 5000000, // KES 50,000
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
  }
  const allProducts = await db.select().from(loanProducts).all();
  const devProduct = allProducts.find((p) => p.name.includes('Development'))!;

  // 5. Seed Historical Monthly Contributions
  const existingContributions = await db.select().from(contributions).all();
  if (existingContributions.length === 0) {
    const periods = ['2026-06', '2026-07', '2026-08', '2026-09'];
    for (const m of allMembers) {
      // Share capital
      await db.insert(contributions).values({
        memberId: m.id,
        typeId: shareType.id,
        amountCents: 1000000, // KES 10,000
        paidAt: new Date('2026-01-20'),
        period: '2026-01',
        method: 'bank',
        reference: `SHR-${m.memberNo}-01`,
        recordedBy: adminUser?.id,
      });

      // Monthly savings & welfare
      for (const p of periods) {
        await db.insert(contributions).values({
          memberId: m.id,
          typeId: savingsType.id,
          amountCents: 200000, // KES 2,000
          paidAt: new Date(`${p}-05`),
          period: p,
          method: 'mpesa',
          reference: `MP-${m.memberNo}-${p}`,
          recordedBy: adminUser?.id,
        });

        await db.insert(contributions).values({
          memberId: m.id,
          typeId: welfareType.id,
          amountCents: 50000, // KES 500
          paidAt: new Date(`${p}-05`),
          period: p,
          method: 'mpesa',
          reference: `WLF-${m.memberNo}-${p}`,
          recordedBy: adminUser?.id,
        });

        if (socialType) {
          await db.insert(contributions).values({
            memberId: m.id,
            typeId: socialType.id,
            amountCents: 30000, // KES 300
            paidAt: new Date(`${p}-05`),
            period: p,
            method: 'cash',
            reference: `SOC-${m.memberNo}-${p}`,
            recordedBy: adminUser?.id,
          });
        }
      }
    }
    console.log('Seeded demo contributions history.');
  }

  // 6. Seed Demo Coffee Produce Deliveries
  const existingProduce = await db.select().from(coffeeProduce).all();
  if (existingProduce.length === 0) {
    const sampleDeliveries = [
      {
        memberId: m3.id, // Sarah Cherono
        factoryGrowerNo: '1402',
        extractedMemberName: 'SARAH CHERONO',
        receiptNo: 'REC-90821',
        receiptDate: new Date('2026-09-08'),
        factoryName: 'Kii Factory',
        societyName: "Rung'eto Farmers Co-op Society",
        grossKg: 154.5,
        tareKg: 4.5,
        netKg: 150.0,
        ratePerKgCents: 11000, // KES 110.00 / KG
        grossAmountCents: 1650000, // KES 16,500.00
        deductionsCents: 50000, // KES 500.00
        netPayoutCents: 1600000, // KES 16,000.00
        receiptImagePath: '/static/images/receipt-placeholder.png',
        ocrRawText: "RUNG'ETO FARMERS CO-OP SOCIETY\nKII FACTORY\nRECEIPT NO: 90821\nDATE: 08/09/2026\nMEMBER NAME: SARAH CHERONO\nGROWER NO: 1402\nGROSS: 154.5 KG\nTARE: 4.5 KG\nNET WT: 150.0 KG\nRATE/KG: KES 110.00\nGROSS AMT: KES 16,500.00\nNET PAYOUT: KES 16,000.00",
        status: 'verified' as const,
        recordedBy: adminUser?.id,
        verifiedByUserId: adminUser?.id,
        verifiedAt: new Date('2026-09-09'),
        notes: 'Cherry Grade 1 delivery verified against society daybook.',
      },
      {
        memberId: m1.id, // John Maina
        factoryGrowerNo: '0844',
        extractedMemberName: 'JOHN MAINA',
        receiptNo: 'REC-90844',
        receiptDate: new Date('2026-09-10'),
        factoryName: 'Gondo Factory',
        societyName: "Rung'eto Farmers Co-op Society",
        grossKg: 215.0,
        tareKg: 5.0,
        netKg: 210.0,
        ratePerKgCents: 11000,
        grossAmountCents: 2310000,
        deductionsCents: 70000,
        netPayoutCents: 2240000,
        receiptImagePath: '/static/images/receipt-placeholder.png',
        ocrRawText: "RUNG'ETO FARMERS CO-OP SOCIETY\nGONDO FACTORY\nRECEIPT NO: 90844\nDATE: 10/09/2026\nMEMBER NAME: JOHN MAINA\nGROWER NO: 0844\nNET WEIGHT: 210.0 KG\nGROSS: 215.0 KG\nRATE: KES 110.00\nNET PAY: KES 22,400.00",
        status: 'verified' as const,
        recordedBy: adminUser?.id,
        verifiedByUserId: adminUser?.id,
        verifiedAt: new Date('2026-09-10'),
        notes: 'Main crop delivery.',
      },
      {
        memberId: m2.id, // Emmanuel Kiprop
        factoryGrowerNo: '2105',
        extractedMemberName: 'EMMANUEL KIPROP',
        receiptNo: 'REC-90899',
        receiptDate: new Date('2026-09-12'),
        factoryName: 'Karimikui Factory',
        societyName: "Rung'eto Farmers Co-op Society",
        grossKg: 88.0,
        tareKg: 3.5,
        netKg: 84.5,
        ratePerKgCents: 11000,
        grossAmountCents: 929500,
        deductionsCents: 30000,
        netPayoutCents: 899500,
        receiptImagePath: '/static/images/receipt-placeholder.png',
        ocrRawText: "RUNG'ETO FARMERS CO-OP SOCIETY\nKARIMIKUI FACTORY\nRECEIPT NO: 90899\nDATE: 12/09/2026\nNAME: EMMANUEL KIPROP\nGROWER: 2105\nNET KGS: 84.5\nTOTAL AMT: KES 9,295.00",
        status: 'pending_verification' as const,
        recordedBy: adminUser?.id,
        notes: 'Scanned via mobile camera receipt capture.',
      },
      {
        memberId: m4.id, // Peter Mwangi
        factoryGrowerNo: '0412',
        extractedMemberName: 'PETER MWANGI',
        receiptNo: 'REC-90910',
        receiptDate: new Date('2026-09-13'),
        factoryName: 'Kii Factory',
        societyName: "Rung'eto Farmers Co-op Society",
        grossKg: 125.0,
        tareKg: 4.0,
        netKg: 121.0,
        ratePerKgCents: 11000,
        grossAmountCents: 1331000,
        deductionsCents: 45000,
        netPayoutCents: 1286000,
        receiptImagePath: '/static/images/receipt-placeholder.png',
        ocrRawText: "RUNG'ETO FARMERS CO-OP SOCIETY\nKII FACTORY\nRECEIPT NO: 90910\nDATE: 13/09/2026\nMEMBER NAME: PETER MWANGI\nGROWER NO: 0412\nNET WT: 121.0 KG",
        status: 'verified' as const,
        recordedBy: adminUser?.id,
        verifiedByUserId: adminUser?.id,
        verifiedAt: new Date('2026-09-13'),
        notes: 'Verified.',
      },
    ];

    for (const d of sampleDeliveries) {
      await db.insert(coffeeProduce).values({
        ...d,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log('Seeded demo coffee produce deliveries.');
  }

  // 7. Seed Demo Loans in KES
  const existingLoans = await db.select().from(loans).all();
  if (existingLoans.length === 0 && devProduct && m1 && m2) {
    const scheduleCalc = computeInstallments({
      principalCents: 2000000, // KES 20,000
      monthlyRateBps: devProduct.interestRateBps,
      method: devProduct.interestMethod,
      termMonths: 6,
    });

    const l1 = await db.insert(loans).values({
      loanNo: 'L-0001',
      memberId: m1.id,
      productId: devProduct.id,
      principalCents: 2000000,
      interestRateBps: devProduct.interestRateBps,
      interestMethod: devProduct.interestMethod,
      termMonths: 6,
      purpose: 'Coffee farm fertilizer and spray inputs',
      status: 'disbursed',
      appliedAt: new Date('2026-07-01'),
      decisionBy: adminUser?.id,
      decisionAt: new Date('2026-07-03'),
      disbursedAt: new Date('2026-07-05'),
      firstDueDate: new Date('2026-08-05'),
      totalPayableCents: scheduleCalc.totalPayableCents,
      outstandingCents: scheduleCalc.totalPayableCents - scheduleCalc.installments[0]!.totalCents,
    }).returning({ id: loans.id }).get();

    if (l1) {
      for (let i = 0; i < scheduleCalc.installments.length; i++) {
        const inst = scheduleCalc.installments[i]!;
        const dueDate = installmentDueDate(new Date('2026-08-05'), i, config.org.timezone);
        const isFirstPaid = i === 0;

        await db.insert(loanSchedule).values({
          loanId: l1.id,
          installmentNo: inst.installmentNo,
          dueDate,
          principalCents: inst.principalCents,
          interestCents: inst.interestCents,
          totalCents: inst.totalCents,
          paidCents: isFirstPaid ? inst.totalCents : 0,
          status: isFirstPaid ? 'paid' : 'pending',
          paidAt: isFirstPaid ? new Date('2026-08-04') : null,
        });
      }

      await db.insert(loanRepayments).values({
        loanId: l1.id,
        memberId: m1.id,
        amountCents: scheduleCalc.installments[0]!.totalCents,
        paidAt: new Date('2026-08-04'),
        method: 'mpesa',
        reference: 'MP-REPAY-001',
        recordedBy: adminUser?.id,
      });
    }

    // Pending Loan for Emanuel
    await db.insert(loans).values({
      loanNo: 'L-0002',
      memberId: m2.id,
      productId: devProduct.id,
      principalCents: 5000000, // KES 50,000
      interestRateBps: devProduct.interestRateBps,
      interestMethod: devProduct.interestMethod,
      termMonths: 4,
      purpose: 'Dairy feeds & coffee pulping machine maintenance',
      status: 'pending',
      appliedAt: new Date('2026-09-10'),
      totalPayableCents: 0,
      outstandingCents: 0,
    });

    console.log('Seeded demo active and pending loans.');
  }

  // 8. Seed Demo Meeting
  const existingMeetings = await db.select().from(meetings).all();
  if (existingMeetings.length === 0) {
    const nextMeetingDate = new Date(Date.now() + 5 * 86400000);
    await db.insert(meetings).values({
      title: "Thumari Men's Association Monthly Meeting & Coffee Yield Review",
      scheduledAt: nextMeetingDate,
      location: 'Kirinyaga Association Grounds & Hybrid Online',
      agenda: '1. Coffee cherry harvest update across Kii & Gondo factories\n2. Review of monthly savings & welfare contributions\n3. Consideration of farm development loan requests\n4. A.O.B.',
      absenceFineCents: 20000, // KES 200
      status: 'scheduled',
      createdBy: adminUser?.id,
    });
    console.log('Seeded demo meeting.');
  }

  // 9. Seed Demo Inbox Notifications
  if (adminUser) {
    const existingNotifications = await db.select().from(notifications).all();
    if (existingNotifications.length === 0) {
      await db.insert(notifications).values([
        {
          userId: adminUser.id,
          eventKey: 'coffee.produce.scanned',
          title: 'New Coffee Produce Delivery Scanned',
          body: 'Emmanuel Kiprop submitted a coffee receipt of 84.5 KGs from Karimikui Factory for review.',
          url: '/coffee',
          pushStatus: 'sent',
          createdAt: new Date('2026-09-12T10:30:00Z'),
        },
        {
          userId: adminUser.id,
          eventKey: 'system.announcement',
          title: "Welcome to Thumari Men's Association Portal",
          body: 'Manage your KES contributions, monthly summaries, loan portfolios, and instant coffee receipt scanning on Android & Web.',
          url: '/dashboard',
          pushStatus: 'sent',
          createdAt: new Date(),
        },
      ]);
      console.log('Seeded demo notifications.');
    }
  }

  console.log('Demo seed completed successfully.');
}

seed().catch(console.error);
