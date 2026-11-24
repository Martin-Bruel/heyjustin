import { Extraction } from '../models/extraction.js';
import {
  formatValidationRecap,
  parseValidationButtonId,
  validationButtonId,
} from './ticket-messages.js';

describe('ticket messages', () => {
  it('formats the recap in English, with day-first dates', () => {
    const recap = formatValidationRecap(
      new Extraction('Acme', new Date('2026-11-01'), 123456, 20576, 'EUR'),
    );

    expect(recap).toContain('Supplier: Acme');
    expect(recap).toContain('Date: 01/11/2026');
    expect(recap).toContain('Total (incl. VAT): €1,234.56');
    expect(recap).toContain('VAT: €205.76');
  });

  it('round-trips validation button ids', () => {
    const id = validationButtonId('cancel', 't1');
    expect(id).toBe('ticket:cancel:t1');
    expect(parseValidationButtonId(id)).toEqual({
      answer: 'cancel',
      ticketId: 't1',
    });
  });

  it('ignores buttons that are not validation buttons', () => {
    expect(parseValidationButtonId('other:validate:t1')).toBeNull();
    expect(parseValidationButtonId('ticket:delete:t1')).toBeNull();
    expect(parseValidationButtonId('ticket:validate')).toBeNull();
  });
});
