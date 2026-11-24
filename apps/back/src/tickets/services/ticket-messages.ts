import type { MessageButton } from '../../messaging/index.js';
import type { Extraction } from '../models/extraction.js';
import type { Reaction } from '../models/reaction.js';

/**
 * How tickets show up in messages, the same on every channel.
 * User-facing text is in English; amounts and dates in the en-GB format
 * (day first, e.g. 01/11/2026 and €1,234.56).
 */

export const EMOJI_BY_REACTION: Record<Reaction, string> = {
  PENDING: '🕓',
  MATCHED: '✅',
  MANUAL: '⚠️',
  FAILED: '❌',
  DUPLICATE: '🔁',
  CANCELLED: '🚫',
};

export type ValidationAnswer = 'validate' | 'cancel';

const BUTTON_ID_PREFIX = 'ticket';

/** Button id carrying the answer and the ticket, e.g. `ticket:validate:<id>`. */
export function validationButtonId(
  answer: ValidationAnswer,
  ticketId: string,
): string {
  return `${BUTTON_ID_PREFIX}:${answer}:${ticketId}`;
}

/** Reads a button id back, `null` if it is not a validation button. */
export function parseValidationButtonId(
  buttonId: string,
): { answer: ValidationAnswer; ticketId: string } | null {
  const [prefix, answer, ticketId] = buttonId.split(':');
  if (prefix !== BUTTON_ID_PREFIX || !ticketId) return null;
  if (answer !== 'validate' && answer !== 'cancel') return null;
  return { answer, ticketId };
}

export function validationButtons(ticketId: string): MessageButton[] {
  return [
    {
      id: validationButtonId('validate', ticketId),
      label: 'Validate',
      style: 'success',
    },
    {
      id: validationButtonId('cancel', ticketId),
      label: 'Cancel',
      style: 'danger',
    },
  ];
}

export function formatOneReceiptPerMessage(receiptCount: number): string {
  return `This message contains ${receiptCount} receipts. Please send them one per message so I can process them.`;
}

export function formatValidationRecap(extraction: Extraction): string {
  const money = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: extraction.currency,
  });
  // issuedOn is a calendar date stored at UTC midnight
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' });

  return [
    '🧾 New receipt',
    `Supplier: ${extraction.supplierName}`,
    `Date: ${date.format(extraction.issuedOn)}`,
    `Total (incl. VAT): ${money.format(extraction.totalCents / 100)}`,
    `VAT: ${money.format(extraction.vatCents / 100)}`,
  ].join('\n');
}
