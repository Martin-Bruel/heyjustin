import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { COMPANIES_LOG_EVENTS } from '../companies-log-events.js';
import { type CompaniesConfig, companiesConfig } from '../companies.config.js';
import { CompanyRepository } from '../repositories/company.repository.js';

/** Fixed, so users can be attached to it by hand (see .env.example). */
export const DEFAULT_COMPANY_ID = '00000000-0000-7000-8000-000000000001';
const DEFAULT_COMPANY_NAME = 'Default';

/**
 * A single-company install: when PENNYLANE_API_TOKEN is set, the default
 * company exists with that token, created or updated at each startup (the
 * env is the source of truth: a new token replaces the old one).
 *
 * At module init, before the channels connect: no receipt arrives before
 * the company exists.
 */
@Injectable()
export class DefaultCompanyService implements OnModuleInit {
  private readonly logger = new Logger(DefaultCompanyService.name);

  constructor(
    @Inject(companiesConfig.KEY)
    private readonly companiesConfig: CompaniesConfig,
    private readonly companyRepository: CompanyRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.companiesConfig.defaultCompanyPennylaneToken;
    if (!token) return;
    await this.companyRepository.upsertWithPennylaneToken({
      id: DEFAULT_COMPANY_ID,
      name: DEFAULT_COMPANY_NAME,
      pennylaneToken: token,
    });
    this.logger.log('Default company ready', {
      event: COMPANIES_LOG_EVENTS.defaultCompanySynced,
      companyId: DEFAULT_COMPANY_ID,
    });
  }
}
