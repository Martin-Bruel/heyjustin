/**
 * Public API of the messaging module: other modules import from here only.
 * Not exported (internal): the Discord client and strategy, ChannelNotEnabledError.
 */
export { MessagingModule } from './messaging.module.js';
export { MessagingGateway } from './messaging.gateway.js';
/** Contract of a messaging app, exported so tests can plug a fake channel into the real gateway. */
export {
  ChannelStrategy,
  type ClickHandler,
  type MessageHandler,
} from './channel-strategy.js';
export type { Channel } from './channel.js';
export type {
  ButtonClick,
  IncomingAttachment,
  IncomingMessage,
  MessageButton,
  MessageEdit,
  OutgoingMessage,
  ProcessingTarget,
  ReactionUpdate,
} from './message.types.js';
