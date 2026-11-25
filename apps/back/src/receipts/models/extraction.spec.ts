import { InvalidExtractionError } from '../errors/invalid-extraction.error.js';
import { Extraction, type ExtractionProps } from './extraction.js';

const props = (overrides: Partial<ExtractionProps> = {}): ExtractionProps => ({
  supplier: {
    name: 'Acme',
    vatNumber: null,
    registrationNumber: null,
    known: null,
  },
  issuedOn: new Date('2026-11-01'),
  totalCents: 120,
  vatCents: 20,
  vatRateBasisPoints: 2000,
  currency: 'EUR',
  ...overrides,
});

describe('Extraction', () => {
  it('rejects VAT above the total', () => {
    expect(
      () => new Extraction(props({ totalCents: 100, vatCents: 200 })),
    ).toThrow(InvalidExtractionError);
  });

  it.each([-1, 10_001, 5.5])('rejects the VAT rate %s', (rate) => {
    expect(() => new Extraction(props({ vatRateBasisPoints: rate }))).toThrow(
      InvalidExtractionError,
    );
  });

  it('accepts a receipt without a printed VAT rate', () => {
    expect(
      new Extraction(props({ vatCents: 0, vatRateBasisPoints: null }))
        .vatRateBasisPoints,
    ).toBeNull();
  });
});
