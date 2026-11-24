/**
 * Builds the real MessagingModule with the given env (DI only: no lifecycle
 * hooks, no Discord login).
 *
 * ConditionalModule decides once per import of the module, when the env is
 * loaded: the module is re-imported for each scenario so the decision is
 * taken again with that scenario's env.
 */
async function compileWith(env: Record<string, string | undefined>) {
  const previous = { ...process.env };
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    vi.resetModules();
    const { ConfigModule } = await import('@nestjs/config');
    const { Test } = await import('@nestjs/testing');
    const { MessagingModule } = await import('./messaging.module.js');
    const { MessagingGateway } = await import('./messaging.gateway.js');

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MessagingModule,
      ],
    }).compile();
    return moduleRef.get(MessagingGateway);
  } finally {
    process.env = previous;
  }
}

describe('MessagingModule', () => {
  it('loads only the channels that are configured', async () => {
    const gateway = await compileWith({ DISCORD_BOT_TOKEN: 'a-token' });
    expect(gateway.enabledChannels).toEqual(['DISCORD']);
  });

  it('refuses to start without any channel', async () => {
    await expect(compileWith({ DISCORD_BOT_TOKEN: undefined })).rejects.toThrow(
      /No messaging channel configured/,
    );
  });

  it('treats an empty variable as not configured', async () => {
    await expect(compileWith({ DISCORD_BOT_TOKEN: '  ' })).rejects.toThrow(
      /No messaging channel configured/,
    );
  });
});
