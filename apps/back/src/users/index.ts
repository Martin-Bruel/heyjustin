/** Public API of the users module: other modules import from here only. */
export { UsersModule } from './users.module.js';
export { UserRepository } from './repositories/user.repository.js';
export {
  UserMessagesService,
  type UserMessageHandler,
} from './services/user-messages.service.js';
export type { User } from './models/user.js';
