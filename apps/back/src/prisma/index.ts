/**
 * Public API of the prisma module: other modules import from here only,
 * never from ./generated directly.
 * Row types are meant for repositories, which map them to domain objects.
 */
export { PrismaModule } from './prisma.module.js';
export { PrismaService } from './prisma.service.js';
export type { Prisma, Ticket, User } from './generated/prisma/client.js';
