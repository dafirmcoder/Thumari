import { describe, it, expect } from 'vitest';
import { parseReceiptText, matchMemberByName } from '../src/lib/ocr-receipt.js';
import type { Member } from '../src/types.js';


describe('Coffee Receipt OCR & Extraction Parser', () => {
  const dummyMembers: Member[] = [
    {
      id: 1,
      memberNo: 'M-0001',
      firstName: 'John',
      lastName: 'Maina',
      phone: '+254 712 345 678',
      email: 'john@thumari.local',
      nationalId: '12345678',
      photoUrl: null,
      joinDate: '2024-01-15',
      status: 'active',
      exitDate: null,
      notes: null,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 2,
      memberNo: 'M-0002',
      firstName: 'Sarah',
      lastName: 'Cherono',
      phone: '+254 722 987 654',
      email: 'sarah@thumari.local',
      nationalId: '87654321',
      photoUrl: null,
      joinDate: '2024-01-15',
      status: 'active',
      exitDate: null,
      notes: null,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },

  ];

  it('matches member by exact and token names', () => {
    const exactMatch = matchMemberByName('SARAH CHERONO', dummyMembers);
    expect(exactMatch.member).not.toBeNull();
    expect(exactMatch.member?.id).toBe(2);
    expect(exactMatch.score).toBe(100);

    const tokenMatch = matchMemberByName('CHERONO SARAH K.', dummyMembers);
    expect(tokenMatch.member?.id).toBe(2);
    expect(tokenMatch.score).toBeGreaterThanOrEqual(50);
  });

  it('extracts farmer name, KGs, and receipt numbers from typical factory receipt', () => {
    const rawReceiptText = [
      "RUNG'ETO FARMERS CO-OPERATIVE SOCIETY LTD",
      'KII FACTORY',
      'CHERRY RECEIPT / DELIVERY SLIP',
      'RECEIPT NO: REC-89211',
      'DATE: 12/09/2026',
      'MEMBER NAME: SARAH CHERONO',
      'GROWER NO: 1402',
      'GROSS WT: 154.5 KG',
      'TARE WT: 4.5 KG',
      'NET WT: 150.0 KG',
      'RATE/KG: KES 110.00',
      'GROSS AMOUNT: KES 16,500.00',
    ].join('\n');

    const result = parseReceiptText(rawReceiptText, dummyMembers);

    expect(result.extractedMemberName).toBe('SARAH CHERONO');
    expect(result.matchedMemberId).toBe(2);
    expect(result.matchedMemberName).toBe('Sarah Cherono');
    expect(result.factoryGrowerNo).toBe('1402');
    expect(result.receiptNo).toBe('REC-89211');
    expect(result.receiptDate).toBe('2026-09-12');
    expect(result.factoryName).toBe('Kii Factory');
    expect(result.societyName).toBe("Rung'eto Farmers Co-op Society");
    expect(result.netKg).toBe(150.0);
    expect(result.grossKg).toBe(154.5);
    expect(result.tareKg).toBe(4.5);
    expect(result.ratePerKg).toBe(110.00);
    expect(result.grossAmount).toBe(16500.00);
  });

  it('handles irregular receipt formats and standalone weights', () => {
    const rawText = [
      'GONDO FACTORY - COFFEE RECEIPT',
      'FARMER: JOHN MAINA',
      'G/NO: 0844',
      'REC: 9021',
      'DATE: 2026-09-10',
      'CHERRY KGS: 84.5',
    ].join('\n');

    const result = parseReceiptText(rawText, dummyMembers);
    expect(result.matchedMemberId).toBe(1);
    expect(result.netKg).toBe(84.5);
    expect(result.receiptNo).toBe('9021');
  });
});
