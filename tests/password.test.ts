import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePassword } from '../src/lib/password.js';

describe('Password & Crypto Security', () => {
  it('hashes and verifies passwords with scrypt', async () => {
    const raw = 'Secret@Secure123';
    const hash = await hashPassword(raw);

    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword(raw, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('validates password strength rules', () => {
    expect(validatePassword('short')).toBe('Password must be at least 8 characters long.');
    expect(validatePassword('AminaJuma123', ['Amina Juma', 'amina@test.com'])).toContain('must not contain your name');
    expect(validatePassword('SecurePassphrase2026!')).toBeNull();
  });
});
