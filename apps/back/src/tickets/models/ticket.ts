import type { Extraction } from '../../receipts/index.js';
import type { SourceMessage } from './source-message.js';
import type { PennylaneInfo } from './pennylane-info.js';
import type { TicketState, TicketStatus } from './ticket-state.js';
import {
  statusesAllowedFor,
  type TicketStateBefore,
  type TicketTransition,
} from './ticket-transitions.js';
import { reactionForStatus, type Reaction } from './reaction.js';
import { InvalidTicketTransitionError } from '../errors/invalid-ticket-transition.error.js';

export type TicketProps = {
  id: string;
  companyId: string;
  userId: string;
  /** The user's message carrying the document. */
  source: SourceMessage;
  caption: string | null;
  state: TicketState;
  /** Reaction currently shown on the channel, which may lag behind the status. */
  displayedReaction: Reaction | null;
  createdAt: Date;
};

export class Ticket {
  readonly id: string;
  readonly companyId: string;
  readonly userId: string;
  readonly source: SourceMessage;
  readonly caption: string | null;
  readonly createdAt: Date;
  private _state: TicketState;
  private _displayedReaction: Reaction | null;

  private constructor(props: TicketProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.userId = props.userId;
    this.source = props.source;
    this.caption = props.caption;
    this.createdAt = props.createdAt;
    this._state = props.state;
    this._displayedReaction = props.displayedReaction;
  }

  /** A new ticket for a document just received on a messaging channel. */
  static create(props: {
    id: string;
    companyId: string;
    userId: string;
    source: SourceMessage;
    caption?: string | null;
  }): Ticket {
    return new Ticket({
      ...props,
      caption: props.caption ?? null,
      state: { status: 'RECEIVED' },
      displayedReaction: null,
      createdAt: new Date(),
    });
  }

  /** Rebuilds a ticket from storage, without running business rules. */
  static restore(props: TicketProps): Ticket {
    return new Ticket(props);
  }

  get state(): Readonly<TicketState> {
    return this._state;
  }

  get status(): TicketStatus {
    return this._state.status;
  }

  /** The receipt data has been read: the recap can be sent for validation. */
  recordExtraction(extraction: Extraction) {
    this.assertTransitionAllowed('recordExtraction');
    this._state = { status: 'AWAITING_VALIDATION', extraction };
  }

  /** The same document was already sent before. */
  markAsDuplicate() {
    this.assertTransitionAllowed('markAsDuplicate');
    this._state = { status: 'DUPLICATE' };
  }

  /** The invoice has been created in Pennylane, waiting for its bank transaction. */
  recordPennylaneImport(pennylane: PennylaneInfo) {
    const { extraction } = this.assertTransitionAllowed(
      'recordPennylaneImport',
    );
    this._state = { status: 'PENDING_MATCH', extraction, pennylane };
  }

  /** The user rejected the recap. */
  cancel() {
    const { extraction } = this.assertTransitionAllowed('cancel');
    this._state = { status: 'CANCELLED', extraction };
  }

  /** The invoice has been matched with a bank transaction. */
  matchTransaction(transactionId: string) {
    const { extraction, pennylane } =
      this.assertTransitionAllowed('matchTransaction');
    this._state = { status: 'MATCHED', extraction, pennylane, transactionId };
  }

  /** No transaction found: the invoice has to be matched by hand in Pennylane. */
  requireManualMatching() {
    const { extraction, pennylane } = this.assertTransitionAllowed(
      'requireManualMatching',
    );
    this._state = { status: 'MANUAL', extraction, pennylane };
  }

  /** Processing failed, the user has to send the document again. */
  fail(reason: string) {
    const state = this.assertTransitionAllowed('fail');
    this._state = {
      status: 'FAILED',
      reason,
      // keep what was extracted, if the failure happened after extraction
      extraction: state.status === 'RECEIVED' ? null : state.extraction,
    };
  }

  // --- Reaction on the channel ---

  get displayedReaction(): Reaction | null {
    return this._displayedReaction;
  }

  /** The reaction the user should see for the current status. */
  get expectedReaction(): Reaction | null {
    return reactionForStatus(this._state.status);
  }

  /** True when the channel does not show the reaction the status calls for. */
  get isReactionOutdated(): boolean {
    return this.expectedReaction !== this._displayedReaction;
  }

  /** Records the reaction actually shown on the channel, once it has been sent. */
  markReactionAsDisplayed(reaction: Reaction | null) {
    this._displayedReaction = reaction;
  }

  /**
   * Throws if the current status cannot start `transition`, otherwise returns
   * the current state narrowed to the statuses allowed for it.
   */
  private assertTransitionAllowed<T extends TicketTransition>(
    transition: T,
  ): TicketStateBefore<T> {
    const allowed = statusesAllowedFor(transition);
    if (!allowed.includes(this._state.status)) {
      throw new InvalidTicketTransitionError(
        transition,
        this._state.status,
        allowed,
      );
    }
    return this._state as TicketStateBefore<T>;
  }
}
