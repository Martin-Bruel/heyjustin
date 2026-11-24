import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/index.js';
import type { Channel } from '../../messaging/index.js';
import type { User } from '../models/user.js';

const USER_FIELDS = {
  id: true,
  companyId: true,
  channel: true,
  externalId: true,
} as const;

/**
 * Users: who is registered, on which channel, with which identity.
 * Lookup only, used directly by other modules (exported by UsersModule).
 * Uses Prisma directly, like every repository of the app.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { id },
      select: USER_FIELDS,
    });
  }

  /** `null` when nobody is registered with this identity on this channel. */
  findByIdentity(channel: Channel, externalId: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { channel_externalId: { channel, externalId } },
      select: USER_FIELDS,
    });
  }
}
