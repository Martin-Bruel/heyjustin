import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { prismaConfig } from './prisma.config.js';
import { PrismaService } from './prisma.service.js';

/** Import it in any module that has a Prisma adapter. */
@Module({
  imports: [ConfigModule.forFeature(prismaConfig)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
