import crypto from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expectedHash = Buffer.from(parts[5] ?? '', 'base64');

  if (!salt.length || !expectedHash.length) return false;

  try {
    const derived = await scryptAsync(password.normalize('NFKC'), salt, expectedHash.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(derived, expectedHash);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function validatePassword(password: string, context: readonly string[] = []): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  const squeeze = (val: string): string => val.toLowerCase().replace(/[^a-z0-9]/g, '');
  const squeezedPassword = squeeze(password);

  for (const value of context) {
    const whole = squeeze(value);
    if (whole.length >= 6 && squeezedPassword.includes(whole)) {
      return 'Password must not contain your name or email address.';
    }
    for (const token of value.split(/[^A-Za-z0-9]+/)) {
      if (token.length >= 4 && squeezedPassword.includes(token.toLowerCase())) {
        return 'Password must not contain your name or email address.';
      }
    }
  }

  return null;
}
