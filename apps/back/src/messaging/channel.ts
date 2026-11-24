/**
 * Messaging app a user talks to us on. Owned by messaging, also used by users
 * and tickets. To support a new app: add a value here and in the Prisma
 * `Channel` enum, then its strategy in this module.
 */
export type Channel = 'WHATSAPP' | 'DISCORD';
