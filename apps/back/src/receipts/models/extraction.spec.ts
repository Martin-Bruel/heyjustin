import { InvalidExtractionError } from '../errors/invalid-extraction.error.js';
import { Extraction } from './extraction.js';

describe('Extraction', () => {
  it('rejects VAT above the total', () => {
    expect(() => new Extraction('Acme', new Date(), 100, 200, 'EUR')).toThrow(
      InvalidExtractionError,
    );
  });
});
