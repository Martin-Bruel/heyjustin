import { IdentifierHasher } from './identifier-hasher.js';

const hasherWith = (hashSecret: string) => new IdentifierHasher({ hashSecret });

describe('IdentifierHasher', () => {
  it('gives the same pseudonym to the same identifier', () => {
    const hasher = hasherWith('secret');
    expect(hasher.hash('33612345678')).toBe(hasher.hash('33612345678'));
    expect(hasher.hash('33612345678')).not.toBe(hasher.hash('33600000000'));
  });

  it('never contains the identifier and depends on the secret', () => {
    const hash = hasherWith('secret').hash('33612345678');
    expect(hash).not.toContain('33612345678');
    expect(hash).toHaveLength(16);
    expect(hasherWith('other').hash('33612345678')).not.toBe(hash);
  });
});
