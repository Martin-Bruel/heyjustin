import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/index.js';
import { PrismaModule } from '../prisma/index.js';
import { UserMessagesService } from './services/user-messages.service.js';
import { UserRepository } from './repositories/user.repository.js';

/**
 * Users, and the messages they send (sender identified).
 * Depends on messaging, never the other way around. Must not import business
 * modules that depend on it (e.g. tickets).
 */
@Module({
  imports: [PrismaModule, MessagingModule],
  providers: [UserRepository, UserMessagesService],
  exports: [UserRepository, UserMessagesService],
})
export class UsersModule {}
