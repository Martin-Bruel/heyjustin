import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { type PrismaConfig, prismaConfig } from './prisma.config.js';

/** The Prisma client, injectable by Nest. Shared by every module, knows no business. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(prismaConfig.KEY) prismaConfig: PrismaConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: prismaConfig.databaseUrl,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
