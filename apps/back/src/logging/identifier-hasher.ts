import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type LoggingConfig, loggingConfig } from './logging.config.js';

/**
 * Turns a personal identifier (a phone number) into a stable pseudonym for
 * logs: the same person always gets the same hash, without logging who it is.
 *
 * HMAC with a secret, not a plain SHA-256: there are only a few billion phone
 * numbers, so an unkeyed hash can be reversed by hashing them all.
 */
@Injectable()
export class IdentifierHasher {
  constructor(
    @Inject(loggingConfig.KEY) private readonly loggingConfig: LoggingConfig,
  ) {}

  hash(identifier: string): string {
    return createHmac('sha256', this.loggingConfig.hashSecret)
      .update(identifier)
      .digest('hex')
      .slice(0, 16);
  }
}
