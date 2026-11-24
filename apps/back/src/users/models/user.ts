import type { Channel } from '../../messaging/index.js';

/** A person sending receipts for their company, on exactly one messaging channel. */
export type User = {
  id: string;
  companyId: string;
  channel: Channel;
  /** The user on their channel: phone number on WhatsApp, user id on Discord. */
  externalId: string;
};
