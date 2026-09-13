import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));

function findRoot(): string {
  const candidateFromHere = path.resolve(here, '..');
  if (fs.existsSync(path.join(candidateFromHere, 'views'))) {
    return candidateFromHere;
  }
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'views'))) {
    return cwd;
  }
  return candidateFromHere;
}

function findViewsDir(): string {
  if (process.env.VIEWS_DIR && fs.existsSync(process.env.VIEWS_DIR)) {
    return process.env.VIEWS_DIR;
  }
  const candidates = [
    path.join(process.cwd(), 'views'),
    path.resolve(here, '..', 'views'),
    path.resolve(here, 'views'),
    path.resolve(here, '..', '..', 'views'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return path.join(process.cwd(), 'views');
}

function findPublicDir(): string {
  if (process.env.PUBLIC_DIR && fs.existsSync(process.env.PUBLIC_DIR)) {
    return process.env.PUBLIC_DIR;
  }
  const candidates = [
    path.join(process.cwd(), 'public'),
    path.resolve(here, '..', 'public'),
    path.resolve(here, 'public'),
    path.resolve(here, '..', '..', 'public'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return path.join(process.cwd(), 'public');
}

// Works from src/ (dev with tsx), dist/ (production build), and serverless environments
export const ROOT = findRoot();
export const SRC_DIR = path.join(ROOT, 'src');
export const VIEWS_DIR = findViewsDir();
export const PUBLIC_DIR = findPublicDir();
export const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp' : path.join(ROOT, 'data'));
export const UPLOADS_DIR = process.env.UPLOADS_DIR || (process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(PUBLIC_DIR, 'uploads'));
export const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
export const MEMBER_PHOTOS_DIR = path.join(UPLOADS_DIR, 'members');
export const EXPENSE_RECEIPTS_DIR = path.join(UPLOADS_DIR, 'expenses');


