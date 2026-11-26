import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  type IncomingAttachment,
  type IncomingMessage,
  MessagingGateway,
} from '../../messaging/index.js';
import { PennylaneInvoicesService } from '../../pennylane/index.js';
import { type User, UserMessagesService } from '../../users/index.js';
import { SourceMessage } from '../models/source-message.js';
import { TicketFile } from '../models/ticket-file.js';
import { ReceiveTicketService } from '../services/receive-ticket.service.js';
import { TicketNotifierService } from '../services/ticket-notifier.service.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/**
 * Entry point of tickets for messages, the same for every channel: turns a
 * message with a receipt attached into an IncomingDocument. Not a Nest
 * @Controller: it receives events, not HTTP requests.
 *
 * Subscribes through UserMessagesService: only registered users get here,
 * with their sender already identified.
 *
 * One receipt per message (the reaction targets the message, not the file):
 * a message with several receipts (possible on Discord, not on WhatsApp) is
 * not processed, the user is asked right away to send them one by one.
 *
 * A file Pennylane does not accept (HEIC, WebP...) is refused here, before
 * the AI reads it: it could be validated but never imported.
 */
@Injectable()
export class TicketMessageHandler implements OnModuleInit {
  private readonly logger = new Logger(TicketMessageHandler.name);

  constructor(
    private readonly userMessagesService: UserMessagesService,
    private readonly messagingGateway: MessagingGateway,
    private readonly receiveTicketService: ReceiveTicketService,
    private readonly ticketNotifierService: TicketNotifierService,
  ) {}

  onModuleInit() {
    this.userMessagesService.onUserMessage((message, sender) =>
      this.handle(message, sender),
    );
  }

  async handle(message: IncomingMessage, sender: User): Promise<void> {
    const receipts = message.attachments.filter(isReceiptFile);
    const [receipt] = receipts;
    if (!receipt) {
      // plain text or unsupported file: not a receipt
      this.logger.debug('Message without receipt ignored', {
        event: TICKET_LOG_EVENTS.messageIgnored,
        reason: 'no_receipt',
      });
      return;
    }

    const source = new SourceMessage(message.channel, message.messageId);

    if (receipts.length > 1) {
      this.logger.log('Message with several receipts rejected', {
        event: TICKET_LOG_EVENTS.messageRejected,
        reason: 'several_receipts',
        receiptCount: receipts.length,
      });
      await this.ticketNotifierService.askOneReceiptPerMessage(
        source,
        sender,
        receipts.length,
      );
      return;
    }

    if (!PennylaneInvoicesService.accepts(receipt.contentType)) {
      this.logger.log('Receipt in an unsupported format rejected', {
        event: TICKET_LOG_EVENTS.messageRejected,
        reason: 'unsupported_file',
        mimeType: receipt.contentType,
      });
      await this.ticketNotifierService.askSupportedFile(source, sender);
      return;
    }

    const data = await this.messagingGateway.download(message.channel, receipt);
    await this.receiveTicketService.receive(sender, {
      source,
      caption: message.text,
      file: new TicketFile(receipt.contentType, receipt.filename, data),
    });
  }
}

function isReceiptFile(
  attachment: IncomingAttachment,
): attachment is IncomingAttachment & { contentType: string } {
  const type = attachment.contentType;
  return !!type && (type.startsWith('image/') || type === 'application/pdf');
}
