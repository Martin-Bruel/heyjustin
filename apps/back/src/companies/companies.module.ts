import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/index.js';
import { companiesConfig } from './companies.config.js';
import { CompanyRepository } from './repositories/company.repository.js';
import { SecretCipher } from './secret-cipher.js';
import { DefaultCompanyService } from './services/default-company.service.js';

/**
 * Companies (the customers) and their secrets: the Pennylane API token,
 * encrypted at rest; the default company of a single-company install
 * (PENNYLANE_API_TOKEN). Depends on Prisma only; knows nothing of the
 * Pennylane API itself.
 */
@Module({
  imports: [PrismaModule, ConfigModule.forFeature(companiesConfig)],
  providers: [SecretCipher, CompanyRepository, DefaultCompanyService],
  exports: [CompanyRepository],
})
export class CompaniesModule {}
