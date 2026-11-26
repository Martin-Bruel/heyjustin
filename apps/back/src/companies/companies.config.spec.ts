import { InvalidConfigError } from '../config/index.js';
import { companiesConfig } from './companies.config.js';

const KEY = 'a'.repeat(64);
const VARIABLES = [
  'HEYJUSTIN_EDITION',
  'SECRETS_ENCRYPTION_KEY',
  'PENNYLANE_API_TOKEN',
];

/** Loads the config with only these variables set. */
function loadWith(env: Record<string, string>) {
  const previous = VARIABLES.map((name) => [name, process.env[name]] as const);
  for (const name of VARIABLES) delete process.env[name];
  Object.assign(process.env, env);
  try {
    return companiesConfig();
  } finally {
    // in place: process.env is a special object, never replace it
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

describe('companiesConfig', () => {
  it('takes the default company token when self-hosted (the default)', () => {
    expect(
      loadWith({ SECRETS_ENCRYPTION_KEY: KEY, PENNYLANE_API_TOKEN: 'token' })
        .defaultCompanyPennylaneToken,
    ).toBe('token');
  });

  it('refuses a default company token in the saas edition', () => {
    expect(() =>
      loadWith({
        HEYJUSTIN_EDITION: 'saas',
        SECRETS_ENCRYPTION_KEY: KEY,
        PENNYLANE_API_TOKEN: 'token',
      }),
    ).toThrow(InvalidConfigError);
    expect(
      loadWith({ HEYJUSTIN_EDITION: 'saas', SECRETS_ENCRYPTION_KEY: KEY })
        .defaultCompanyPennylaneToken,
    ).toBeNull();
  });
});
