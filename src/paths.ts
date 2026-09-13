import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// Works both from src/ (dev with tsx) and dist/ (production build)
export const ROOT = path.resolve(here, '..');
export const SRC_DIR = path.join(ROOT, 'src');
export const VIEWS_DIR = path.join(ROOT, 'views');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
export const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
export const MEMBER_PHOTOS_DIR = path.join(UPLOADS_DIR, 'members');
export const EXPENSE_RECEIPTS_DIR = path.join(UPLOADS_DIR, 'expenses');
