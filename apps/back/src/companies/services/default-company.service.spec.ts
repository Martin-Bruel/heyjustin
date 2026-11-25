import { Logger } from '@nestjs/common';
import type { CompaniesConfig } from '../companies.config.js';
import type { CompanyRepository } from '../repositories/company.repository.js';
import {
  DEFAULT_COMPANY_ID,
  DefaultCompanyService,
} from './default-company.service.js';

function setup(defaultCompanyPennylaneToken: string | null) {
  const upserts: unknown[] = [];
  const repository = {
    findPennylaneToken: () => Promise.resolve(null),
    upsertWithPennylaneToken: (company: unknown) => {
      upserts.push(company);
      return Promise.resolve();
    },
  } satisfies Record<keyof CompanyRepository, unknown>;
  const config: CompaniesConfig = {
    secretsEncryptionKey: Buffer.alloc(32),
    defaultCompanyPennylaneToken,
  };
  const service = new DefaultCompanyService(
    config,
    repository as unknown as CompanyRepository,
  );
  return { service, upserts };
}

describe('DefaultCompanyService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('creates or updates the default company with the token of the env', async () => {
    const { service, upserts } = setup('env-token');

    await service.onModuleInit();

    expect(upserts).toEqual([
      { id: DEFAULT_COMPANY_ID, name: 'Default', pennylaneToken: 'env-token' },
    ]);
  });

  it('does nothing without a token', async () => {
    const { service, upserts } = setup(null);

    await service.onModuleInit();

    expect(upserts).toEqual([]);
  });

  it('never logs the token', async () => {
    const log = vi.spyOn(Logger.prototype, 'log');
    const { service } = setup('env-token');

    await service.onModuleInit();

    expect(JSON.stringify(log.mock.calls)).not.toContain('env-token');
  });
});
