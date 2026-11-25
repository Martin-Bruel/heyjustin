/**
 * A stored secret could not be decrypted: wrong SECRETS_ENCRYPTION_KEY, or
 * the value was changed in the database. Never carries the value.
 */
export class UndecryptableSecretError extends Error {
  constructor() {
    super(
      'Stored secret could not be decrypted (wrong SECRETS_ENCRYPTION_KEY or altered value)',
    );
    this.name = 'UndecryptableSecretError';
  }
}
