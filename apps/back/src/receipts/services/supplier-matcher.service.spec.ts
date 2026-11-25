import type { KnownSupplier } from '../models/supplier-identifiers.js';
import { SupplierMatcherService } from './supplier-matcher.service.js';

const known: KnownSupplier[] = [
  { id: '1', name: 'easyJet', vatNumber: null, registrationNumber: null },
  {
    id: '2',
    name: 'Acme SAS',
    // stored as typed in the accounting tool
    vatNumber: 'fr 40 123 456 789',
    registrationNumber: null,
  },
];

const noIdentifier = { vatNumber: null, registrationNumber: null };

describe('SupplierMatcherService', () => {
  const matcher = new SupplierMatcherService();

  it('matches by VAT number first, whatever the AI chose', () => {
    expect(
      matcher.match(
        { vatNumber: 'FR40123456789', registrationNumber: '123456789' },
        '1',
        known,
      ),
    ).toEqual({ id: '2', name: 'Acme SAS' });
  });

  it('matches by SIREN, also against a known French VAT number', () => {
    expect(
      matcher.match(
        { vatNumber: null, registrationNumber: '123456789' },
        null,
        known,
      ),
    ).toEqual({ id: '2', name: 'Acme SAS' });
  });

  it('does not decide by an identifier several suppliers share', () => {
    const twins = [
      { ...known[1], id: '3' },
      { ...known[1], id: '4' },
    ];

    expect(
      matcher.match(
        { vatNumber: 'FR40123456789', registrationNumber: null },
        null,
        twins,
      ),
    ).toBeNull();
  });

  it('keeps the choice of the AI when it is one of the known suppliers', () => {
    expect(matcher.match(noIdentifier, '1', known)).toEqual({
      id: '1',
      name: 'easyJet',
    });
  });

  it('gives a new supplier when the AI chose none, or an id that was not sent', () => {
    expect(matcher.match(noIdentifier, null, known)).toBeNull();
    expect(matcher.match(noIdentifier, '99', known)).toBeNull();
  });

  it('refuses the choice of the AI when a printed identifier contradicts it', () => {
    expect(
      matcher.match(
        { vatNumber: 'FR99999999999', registrationNumber: null },
        '2',
        known,
      ),
    ).toBeNull();
  });
});
