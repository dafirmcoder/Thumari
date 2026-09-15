import { createWorker } from 'tesseract.js';
import type { Member } from '../types.js';

export interface ExtractedReceiptData {
  rawText: string;
  extractedMemberName: string | null;
  matchedMemberId: number | null;
  matchedMemberName: string | null;
  confidence: number; // 0 - 100
  factoryGrowerNo: string | null;
  receiptNo: string | null;
  receiptDate: string | null; // YYYY-MM-DD
  factoryName: string | null;
  societyName: string | null;
  grossKg: number | null;
  tareKg: number | null;
  netKg: number | null;
  ratePerKg: number | null; // in currency units
  grossAmount: number | null;
  deductions: number | null;
  netPayout: number | null;
}

const KNOWN_SOCIETIES = [
  "Rung'eto Farmers Co-op Society",
  'Baragwi Farmers Co-op Society',
  'Kabare Farmers Co-op Society',
  'Mutira Farmers Co-op Society',
  'Inoi Farmers Co-op Society',
  'Ngiriambu Farmers Co-op Society',
  'Kirinyaga Coffee Growers',
];

const KNOWN_FACTORIES = [
  'Kii Factory',
  'Gondo Factory',
  'Karimikui Factory',
  'Kiangoi Factory',
  'Kianjiru Factory',
  'Raimu Factory',
  'Kianyaga Factory',
  'Kibirigwi Factory',
  'Mukure Factory',
  'Gicherori Factory',
  'Thunguri Factory',
];

export function matchMemberByName(
  extractedName: string | null | undefined,
  membersList: Member[],
): { member: Member | null; score: number } {
  if (!extractedName || !membersList.length) {
    return { member: null, score: 0 };
  }

  const cleanExtracted = extractedName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();
  const extractedTokens = cleanExtracted.split(/\s+/).filter((t) => t.length >= 2);

  if (!extractedTokens.length) return { member: null, score: 0 };

  let bestMember: Member | null = null;
  let bestScore = 0;

  for (const m of membersList) {
    const fullName = `${m.firstName} ${m.lastName}`.toUpperCase();
    const cleanFull = fullName.replace(/[^A-Z0-9\s]/g, ' ').trim();
    const memberTokens = cleanFull.split(/\s+/).filter((t) => t.length >= 2);

    if (cleanExtracted === cleanFull) {
      return { member: m, score: 100 };
    }

    let matchedTokenCount = 0;
    for (const et of extractedTokens) {
      for (const mt of memberTokens) {
        if (et === mt || (et.length > 3 && mt.includes(et)) || (mt.length > 3 && et.includes(mt))) {
          matchedTokenCount++;
          break;
        }
      }
    }

    const tokenScore = (matchedTokenCount / Math.max(memberTokens.length, 1)) * 100;
    let substringBonus = 0;
    if (cleanExtracted.includes(cleanFull) || cleanFull.includes(cleanExtracted)) {
      substringBonus = 25;
    }

    const totalScore = Math.min(100, Math.round(tokenScore + substringBonus));

    if (totalScore > bestScore && totalScore >= 40) {
      bestScore = totalScore;
      bestMember = m;
    }
  }

  return { member: bestMember, score: bestScore };
}

export function parseReceiptText(rawText: string, membersList: Member[] = []): ExtractedReceiptData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let extractedMemberName: string | null = null;
  let factoryGrowerNo: string | null = null;
  let receiptNo: string | null = null;
  let receiptDate: string | null = null;
  let factoryName: string | null = null;
  let societyName: string | null = null;
  let grossKg: number | null = null;
  let tareKg: number | null = null;
  let netKg: number | null = null;
  let ratePerKg: number | null = null;
  let grossAmount: number | null = null;
  let deductions: number | null = null;
  let netPayout: number | null = null;

  for (const line of lines) {
    const lineUpper = line.toUpperCase();
    for (const soc of KNOWN_SOCIETIES) {
      if (lineUpper.includes(soc.toUpperCase()) || lineUpper.includes('FCS') || lineUpper.includes('SOCIETY')) {
        if (!societyName) societyName = soc;
      }
    }
    for (const fact of KNOWN_FACTORIES) {
      if (lineUpper.includes(fact.toUpperCase()) || lineUpper.includes('FACTORY')) {
        if (!factoryName) factoryName = fact;
      }
    }
  }

  for (const line of lines) {

    // Member Name:
    if (!extractedMemberName) {
      const isHeaderLine = /(?:SOCIETY|CO-OP|COOPERATIVE|FACTORY|LIMITED|LTD|DELIVERY|RECEIPT|SLIP)/i.test(line);
      if (!isHeaderLine) {
        const nameMatch = line.match(
          /(?:MEMBER\s*NAME|FARMER\s*NAME|GROWER\s*NAME|PRODUCER\s*NAME|\bNAME\b|\bMEMBER\b|\bFARMER\b)\s*[:#-]?\s*([A-Za-z\s.'-]{3,40})/i,
        );
        if (nameMatch && nameMatch[1]) {
          const potentialName = nameMatch[1].trim();
          if (!/^(KG|KGS|DATE|NO|RECEIPT|FACTORY|TOTAL|SLIP)/i.test(potentialName) && potentialName.length >= 3) {
            extractedMemberName = potentialName;
          }
        }
      }
    }

    // Factory / Grower No:
    if (!factoryGrowerNo) {
      const growerMatch = line.match(/(?:GROWER\s*NO|FACTORY\s*NO|ACC(?:OUNT)?\s*NO|M\/NO|\bG\/NO\b|\bGROWER\b)\s*[:#-]?\s*([A-Za-z0-9\/-]{1,15})/i);
      if (growerMatch && growerMatch[1]) {
        factoryGrowerNo = growerMatch[1].trim();
      }
    }

    // Receipt / Ticket / Slip No:
    if (!receiptNo) {
      const recMatch = line.match(/(?:RECEIPT\s*NO|REC\s*NO|SLIP\s*NO|TICKET\s*NO|INVOICE\s*NO|\bREC\b|\bSLIP\b)\s*[:#-]\s*([A-Za-z0-9\/-]{2,20})/i);
      if (recMatch && recMatch[1]) {
        receiptNo = recMatch[1].trim();
      }
    }

    if (!receiptDate) {
      const dateMatch = line.match(/(\b\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}\b|\b\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}\b)/);
      if (dateMatch && dateMatch[1]) {
        const rawDate = dateMatch[1];
        const parsed = parseDateString(rawDate);
        if (parsed) receiptDate = parsed;
      }
    }

    if (netKg === null) {
      const netMatch = line.match(/(?:NET\s*WT|NET\s*WEIGHT|NET\s*KGS?|CHERRY\s*KGS?|COFFEE\s*KGS?|TOTAL\s*KGS?|NET)\s*[:=-]?\s*([\d]+(?:[\.,]\d{1,2})?)/i);
      if (netMatch && netMatch[1]) {
        netKg = parseFloat(netMatch[1].replace(',', '.'));
      }
    }

    if (grossKg === null) {
      const grossMatch = line.match(/(?:GROSS\s*WT|GROSS\s*WEIGHT|GROSS\s*KGS?|GROSS)\s*[:=-]?\s*([\d]+(?:[\.,]\d{1,2})?)/i);
      if (grossMatch && grossMatch[1]) {
        grossKg = parseFloat(grossMatch[1].replace(',', '.'));
      }
    }

    if (tareKg === null) {
      const tareMatch = line.match(/(?:TARE\s*WT|TARE\s*WEIGHT|TARE\s*KGS?|TARE|BAGS)\s*[:=-]?\s*([\d]+(?:[\.,]\d{1,2})?)/i);
      if (tareMatch && tareMatch[1]) {
        tareKg = parseFloat(tareMatch[1].replace(',', '.'));
      }
    }

    if (ratePerKg === null) {
      const rateMatch = line.match(/(?:RATE\s*\/KG|RATE\s*PER\s*KG|PRICE\s*\/KG|RATE)\s*[:=-]?\s*KES?\.?\s*([\d]+(?:[\.,]\d{1,2})?)/i);
      if (rateMatch && rateMatch[1]) {
        ratePerKg = parseFloat(rateMatch[1].replace(',', '.'));
      }
    }

    if (grossAmount === null) {
      const grossAmtMatch = line.match(/(?:GROSS\s*PAY|GROSS\s*AMT|GROSS\s*AMOUNT|TOTAL\s*AMOUNT)\s*[:=-]?\s*KES?\.?\s*([\d,]+(?:[\.,]\d{1,2})?)/i);
      if (grossAmtMatch && grossAmtMatch[1]) {
        grossAmount = parseFloat(grossAmtMatch[1].replace(/,/g, ''));
      }
    }

    if (deductions === null) {
      const dedMatch = line.match(/(?:DEDUCTIONS?|CESS|LEVY|STORES)\s*[:=-]?\s*KES?\.?\s*([\d,]+(?:[\.,]\d{1,2})?)/i);
      if (dedMatch && dedMatch[1]) {
        deductions = parseFloat(dedMatch[1].replace(/,/g, ''));
      }
    }

    if (netPayout === null) {
      const netPayMatch = line.match(/(?:NET\s*PAY|NET\s*AMOUNT|PAYABLE|NET\s*PAYOUT)\s*[:=-]?\s*KES?\.?\s*([\d,]+(?:[\.,]\d{1,2})?)/i);
      if (netPayMatch && netPayMatch[1]) {
        netPayout = parseFloat(netPayMatch[1].replace(/,/g, ''));
      }
    }
  }

  if (netKg === null && grossKg !== null) {
    netKg = grossKg - (tareKg || 0);
  } else if (grossKg === null && netKg !== null) {
    grossKg = netKg + (tareKg || 0);
  }

  if (netKg === null) {
    for (const line of lines) {
      const generalKgMatch = line.match(/\b([\d]+(?:\.\d{1,2})?)\s*(?:KGS?|KILOS?|KG)\b/i);
      if (generalKgMatch && generalKgMatch[1]) {
        const val = parseFloat(generalKgMatch[1]);
        if (val > 0 && val < 50000) {
          netKg = val;
          grossKg = grossKg ?? val;
          break;
        }
      }
    }
  }

  let matchedMemberId: number | null = null;
  let matchedMemberName: string | null = null;
  let matchConfidence = 0;

  if (extractedMemberName && membersList.length) {
    const match = matchMemberByName(extractedMemberName, membersList);
    if (match.member) {
      matchedMemberId = match.member.id;
      matchedMemberName = `${match.member.firstName} ${match.member.lastName}`;
      matchConfidence = match.score;
    }
  } else if (!extractedMemberName && membersList.length) {
    for (const line of lines) {
      const match = matchMemberByName(line, membersList);
      if (match.member && match.score >= 70) {
        matchedMemberId = match.member.id;
        matchedMemberName = `${match.member.firstName} ${match.member.lastName}`;
        extractedMemberName = line.trim();
        matchConfidence = match.score;
        break;
      }
    }
  }

  return {
    rawText,
    extractedMemberName,
    matchedMemberId,
    matchedMemberName,
    confidence: matchConfidence,
    factoryGrowerNo,
    receiptNo,
    receiptDate: receiptDate || new Date().toISOString().slice(0, 10),
    factoryName: factoryName || (societyName ? `${societyName} Factory` : 'Thumari Factory'),
    societyName: societyName || "Rung'eto Farmers Co-op Society",
    grossKg: grossKg !== null ? Math.round(grossKg * 100) / 100 : null,
    tareKg: tareKg !== null ? Math.round(tareKg * 100) / 100 : 0,
    netKg: netKg !== null ? Math.round(netKg * 100) / 100 : null,
    ratePerKg: ratePerKg,
    grossAmount: grossAmount,
    deductions: deductions,
    netPayout: netPayout,
  };
}

export async function performReceiptOcr(
  imagePathOrBuffer: string | any,
  membersList: Member[] = [],
  onProgress?: (progress: number, status: string) => void,
): Promise<ExtractedReceiptData> {
  const worker = await createWorker('eng', 1, {
    logger: (m: any) => {
      if (onProgress && m.progress !== undefined) {
        onProgress(m.progress, m.status || 'Processing...');
      }
    },
  });
  try {
    const ret = await worker.recognize(imagePathOrBuffer);
    const rawText = ret.data.text || '';
    return parseReceiptText(rawText, membersList);
  } finally {
    await worker.terminate();
  }
}

export const extractReceiptData = performReceiptOcr;


function parseDateString(str: string): string | null {
  try {
    const parts = str.split(/[-/\.]/);
    if (parts.length === 3) {
      let year = parseInt(parts[2] || '', 10);
      let month = parseInt(parts[1] || '', 10);
      let day = parseInt(parts[0] || '', 10);

      if (parts[0] && parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1] || '', 10);
        day = parseInt(parts[2] || '', 10);
      } else if (year < 100) {
        year = 2000 + year;
      }

      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  } catch {
    // fallback
  }
  return null;
}
