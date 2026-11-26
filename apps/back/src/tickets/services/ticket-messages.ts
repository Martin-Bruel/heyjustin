import type { MessageButton } from '../../messaging/index.js';
import type { Extraction } from '../../receipts/index.js';
import type { Reaction } from '../models/reaction.js';
import type { TicketState } from '../models/ticket-state.js';

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

/** The reason is one of our fixed failure reasons: no customer data. */
export function formatProcessingFailure(reason: string): string {
  return `❌ I could not process this receipt: ${reason}. Please send it again.`;
}

export function formatUnsupportedFile(): string {
  return 'I cannot import this file type into Pennylane. Please send the receipt as a photo (JPEG or PNG) or a PDF.';
}

/**
 * The recap once answered: the same text, followed by what became of the
 * ticket (it has no buttons any more). `null` while it awaits an answer.
 */
export function formatAnsweredRecap(state: TicketState): string | null {
  const outcome = recapOutcome(state);
  return outcome && 'extraction' in state && state.extraction
    ? `${formatValidationRecap(state.extraction)}\n\n${outcome}`
    : null;
}

function recapOutcome(state: TicketState): string | null {
  switch (state.status) {
    case 'IMPORTING':
      return '⏳ Importing into Pennylane…';
    case 'PENDING_MATCH':
    case 'MATCHED':
    case 'MANUAL':
      return '📥 Imported into Pennylane.';
    case 'CANCELLED':
      return '🚫 Cancelled.';
    case 'FAILED':
      return `❌ Not imported: ${state.reason}. Please send the receipt again.`;
    default:
      return null;
  }
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
    `Supplier: ${supplierLine(extraction)}`,
    `Date: ${date.format(extraction.issuedOn)}`,
    `Total (incl. VAT): ${money.format(extraction.totalCents / 100)}`,
    `${vatLabel(extraction.vatRateBasisPoints)}: ${money.format(extraction.vatCents / 100)}`,
  ].join('\n');
}

/** The supplier the invoice will go to: an existing one, or a new one. */
function supplierLine({ supplier }: Extraction): string {
  return supplier.known
    ? `${supplier.known.name} (existing in Pennylane)`
    : `${supplier.name} (new in Pennylane)`;
}

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 2,
});

/** `VAT (20%)`, or `VAT` when the receipt prints no rate. */
function vatLabel(rateBasisPoints: number | null): string {
  return rateBasisPoints === null
    ? 'VAT'
    : `VAT (${percent.format(rateBasisPoints / 10_000)})`;
}
