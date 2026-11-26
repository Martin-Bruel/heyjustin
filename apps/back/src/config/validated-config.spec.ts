import { z } from 'zod';
import { appConfig } from './app.config.js';
import { InvalidConfigError, validatedConfig } from './validated-config.js';

/** Runs `fn` with these env variables only for the given names, then restores them. */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previous = Object.fromEntries(
    Object.keys(vars).map((name) => [name, process.env[name]]),
  );
  const apply = (values: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  apply(vars);
  try {
    return fn();
  } finally {
    apply(previous);
  }
}

const tokenConfig = validatedConfig(
  'example',
  z.object({ EXAMPLE_TOKEN: z.string().min(10) }),
  (env) => ({ token: env.EXAMPLE_TOKEN }),
);

describe('validatedConfig', () => {
  it('returns the mapped, typed values when the env is valid', () => {
    const config = withEnv({ EXAMPLE_TOKEN: 'a-long-token' }, () =>
      tokenConfig(),
    );
    expect(config).toEqual({ token: 'a-long-token' });
  });

  it('refuses to load with a message naming the variable', () => {
    expect(() =>
      withEnv({ EXAMPLE_TOKEN: undefined }, () => tokenConfig()),
    ).toThrow(InvalidConfigError);
    expect(() =>
      withEnv({ EXAMPLE_TOKEN: undefined }, () => tokenConfig()),
    ).toThrow(/Invalid configuration for "example":\n {2}- EXAMPLE_TOKEN/);
  });

  it('never puts the invalid value in the message (it can be a secret)', () => {
    let message = '';
    try {
      withEnv({ EXAMPLE_TOKEN: 'secret' }, () => tokenConfig());
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('EXAMPLE_TOKEN');
    expect(message).not.toContain('secret');
  });
});

describe('appConfig', () => {
  it('defaults to development on port 3000, self-hosted', () => {
    const config = withEnv(
      { NODE_ENV: undefined, PORT: undefined, HEYJUSTIN_EDITION: undefined },
      () => appConfig(),
    );
    expect(config).toEqual({
      edition: 'self-hosted',
      nodeEnv: 'development',
      isProduction: false,
      port: 3000,
    });
  });

  it('refuses an unknown edition', () => {
    expect(() =>
      withEnv({ HEYJUSTIN_EDITION: 'cloud' }, () => appConfig()),
    ).toThrow(/HEYJUSTIN_EDITION/);
  });

  it('reads production and a numeric port', () => {
    const config = withEnv({ NODE_ENV: 'production', PORT: '8080' }, () =>
      appConfig(),
    );
    expect(config).toMatchObject({ isProduction: true, port: 8080 });
  });

  it('rejects an unknown NODE_ENV and a non-numeric port', () => {
    expect(() =>
      withEnv({ NODE_ENV: 'staging', PORT: 'abc' }, () => appConfig()),
    ).toThrow(/NODE_ENV[\s\S]*PORT/);
  });
});
