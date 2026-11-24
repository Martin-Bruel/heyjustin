/**
 * The image or PDF received on a messaging channel.
 * Stored apart from the ticket and only loaded when needed (it can be large).
 */
export class TicketFile {
  constructor(
    /** e.g. image/jpeg, application/pdf */
    readonly mimeType: string,
    /** Not always provided (e.g. WhatsApp only sends it for documents, not photos). */
    readonly filename: string | null,
    readonly data: Buffer,
  ) {}
}
