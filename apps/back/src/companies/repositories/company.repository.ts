import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/index.js';
import { SecretCipher } from '../secret-cipher.js';

/**
 * Companies and their Pennylane access. The token is encrypted here, on its
 * way to the database, and decrypted on its way out: nobody else sees the
 * stored form.
 */
@Injectable()
export class CompanyRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly secretCipher: SecretCipher,
  ) {}

  /** The company's Pennylane API token, `null` when none is set. */
  async findPennylaneToken(companyId: string): Promise<string | null> {
    const company = await this.prismaService.company.findUnique({
      where: { id: companyId },
      select: { pennylaneApiToken: true },
    });
    return company?.pennylaneApiToken
      ? this.secretCipher.decrypt(company.pennylaneApiToken)
      : null;
  }

  /**
   * Creates the company with this id, or updates its token. An upsert on the
   * id: two instances starting together cannot create it twice. The name is
   * only set on creation, so a rename in the database is kept.
   */
  async upsertWithPennylaneToken(company: {
    id: string;
    name: string;
    pennylaneToken: string;
  }): Promise<void> {
    const pennylaneApiToken = this.secretCipher.encrypt(company.pennylaneToken);
    await this.prismaService.company.upsert({
      where: { id: company.id },
      create: { id: company.id, name: company.name, pennylaneApiToken },
      update: { pennylaneApiToken },
    });
  }
}
