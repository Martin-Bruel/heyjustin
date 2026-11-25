import { Extraction, type ExtractionProps } from '../../receipts/index.js';
import {
  formatValidationRecap,
  parseValidationButtonId,
  validationButtonId,
} from './ticket-messages.js';

describe('ticket messages', () => {
  const extractionWith = (
    overrides: Partial<ExtractionProps> = {},
  ): Extraction =>
    new Extraction({
      supplier: {
        name: 'easyJet Airline Company Limited',
        vatNumber: null,
        registrationNumber: null,
        known: null,
      },
      issuedOn: new Date('2026-11-01'),
      totalCents: 123456,
      vatCents: 20576,
      vatRateBasisPoints: 2000,
      currency: 'EUR',
      ...overrides,
    });

  it('formats the recap in English, with day-first dates', () => {
    const recap = formatValidationRecap(extractionWith());

    expect(recap).toContain(
      'Supplier: easyJet Airline Company Limited (new in Pennylane)',
    );
    expect(recap).toContain('Date: 01/11/2026');
    expect(recap).toContain('Total (incl. VAT): €1,234.56');
    expect(recap).toContain('VAT (20%): €205.76');
  });

  it('shows the existing supplier under its Pennylane name', () => {
    const recap = formatValidationRecap(
      extractionWith({
        supplier: {
          name: 'easyJet Airline Company Limited',
          vatNumber: null,
          registrationNumber: null,
          known: { id: '1', name: 'easyJet' },
        },
      }),
    );

    expect(recap).toContain('Supplier: easyJet (existing in Pennylane)');
  });

  it('shows decimal VAT rates, and no rate when none is printed', () => {
    const recap = (vatRateBasisPoints: number | null) =>
      formatValidationRecap(
        extractionWith({ totalCents: 1055, vatCents: 55, vatRateBasisPoints }),
      );

    expect(recap(550)).toContain('VAT (5.5%): €0.55');
    expect(recap(null)).toContain('VAT: €0.55');
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
