import { randomBytes } from 'node:crypto';
import type { CompaniesConfig } from './companies.config.js';
import { UndecryptableSecretError } from './errors/undecryptable-secret.error.js';
import { SecretCipher } from './secret-cipher.js';

/** A key as the config gives it: 32 bytes, from hex. */
const newKey = () => Buffer.from(randomBytes(32).toString('hex'), 'hex');

const cipherWith = (key: Buffer<ArrayBuffer>) =>
  new SecretCipher({
    secretsEncryptionKey: key,
    defaultCompanyPennylaneToken: null,
  } satisfies CompaniesConfig);

const cipher = cipherWith(newKey());

describe('SecretCipher', () => {
  it('decrypts what it encrypted, without the secret in the stored value', () => {
    const stored = cipher.encrypt('pennylane-token-123');

    expect(stored).toMatch(/^v1\./);
    expect(stored).not.toContain('pennylane-token-123');
    expect(cipher.decrypt(stored)).toBe('pennylane-token-123');
  });

  it('gives a different value each time (random IV)', () => {
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('refuses a value encrypted with another key', () => {
    const stored = cipherWith(newKey()).encrypt('token');

    expect(() => cipher.decrypt(stored)).toThrow(UndecryptableSecretError);
  });

  it('refuses an altered value', () => {
    const [version, iv, tag, ciphertext] = cipher.encrypt('token').split('.');
    const altered = Buffer.from(ciphertext, 'base64url');
    altered[0] ^= 1;

    expect(() =>
      cipher.decrypt(
        [version, iv, tag, altered.toString('base64url')].join('.'),
      ),
    ).toThrow(UndecryptableSecretError);
  });

  it.each(['', 'plain-token', 'v2.a.b.c'])(
    'refuses a value that is not encrypted: %o',
    (stored) => {
      expect(() => cipher.decrypt(stored)).toThrow(UndecryptableSecretError);
    },
  );
});
