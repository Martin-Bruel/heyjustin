import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type CompaniesConfig, companiesConfig } from './companies.config.js';
import { UndecryptableSecretError } from './errors/undecryptable-secret.error.js';

const ALGORITHM = 'aes-256-gcm';
/** Bumped if the algorithm changes, so old values stay readable. */
const VERSION = 'v1';
const IV_BYTES = 12;

/**
 * Encrypts the secrets stored for a company (API tokens), so a database dump
 * or a backup does not give access to their accounting.
 *
 * AES-256-GCM: authenticated, an altered value fails to decrypt instead of
 * giving garbage. A random IV per value: the same token twice gives two
 * different values. Stored as `v1.<iv>.<tag>.<ciphertext>` (base64url).
 */
@Injectable()
export class SecretCipher {
  constructor(
    @Inject(companiesConfig.KEY)
    private readonly companiesConfig: CompaniesConfig,
  ) {}

  encrypt(secret: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(
      ALGORITHM,
      this.companiesConfig.secretsEncryptionKey,
      iv,
    );
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
      .map((part) =>
        typeof part === 'string' ? part : part.toString('base64url'),
      )
      .join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, ciphertext] = stored.split('.');
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
      throw new UndecryptableSecretError();
    }
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.companiesConfig.secretsEncryptionKey,
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // the cause would say nothing more useful, and never the value
      throw new UndecryptableSecretError();
    }
  }
}
