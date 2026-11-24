import { SourceMessage } from './source-message.js';
import { Ticket } from './ticket.js';
import { Extraction } from '../../receipts/index.js';
import { PennylaneInfo } from './pennylane-info.js';
import { InvalidTicketTransitionError } from '../errors/invalid-ticket-transition.error.js';

const newTicket = () =>
  Ticket.create({
    id: 't1',
    companyId: 'c1',
    userId: 'u1',
    source: new SourceMessage('WHATSAPP', 'wamid.1'),
  });

const extraction = new Extraction(
  'Acme',
  new Date('2026-11-01'),
  1200,
  200,
  'EUR',
);
const pennylane = new PennylaneInfo('sup_1', 'inv_1');

describe('Ticket lifecycle', () => {
  it('starts as RECEIVED', () => {
    expect(newTicket().status).toBe('RECEIVED');
  });

  it('goes through the happy path and keeps data along the way', () => {
    const ticket = newTicket();
    ticket.recordExtraction(extraction);
    ticket.recordPennylaneImport(pennylane);
    ticket.matchTransaction('tx_1');

    expect(ticket.state).toEqual({
      status: 'MATCHED',
      extraction,
      pennylane,
      transactionId: 'tx_1',
    });
  });

  it('can fail before extraction, without extraction data', () => {
    const ticket = newTicket();
    ticket.fail('unreadable');
    expect(ticket.state).toEqual({
      status: 'FAILED',
      reason: 'unreadable',
      extraction: null,
    });
  });

  it('can fail after extraction, keeping the extraction', () => {
    const ticket = newTicket();
    ticket.recordExtraction(extraction);
    ticket.fail('pennylane down');
    expect(ticket.state).toEqual({
      status: 'FAILED',
      reason: 'pennylane down',
      extraction,
    });
  });

  it('rejects a transition from a status not listed in TICKET_TRANSITIONS', () => {
    const ticket = newTicket();
    expect(() => ticket.matchTransaction('tx_1')).toThrow(
      InvalidTicketTransitionError,
    );
  });

  it('cannot leave a final status', () => {
    const ticket = newTicket();
    ticket.markAsDuplicate();
    expect(() => ticket.recordExtraction(extraction)).toThrow(
      InvalidTicketTransitionError,
    );
  });
});

describe('Ticket reaction', () => {
  it('shows PENDING as soon as the ticket is received', () => {
    const ticket = newTicket();
    expect(ticket.expectedReaction).toBe('PENDING');
    expect(ticket.isReactionOutdated).toBe(true);
  });

  it('is outdated after a transition until the reaction is displayed', () => {
    const ticket = newTicket();
    ticket.markReactionAsDisplayed('PENDING');
    ticket.recordExtraction(extraction);
    ticket.recordPennylaneImport(pennylane);
    expect(ticket.isReactionOutdated).toBe(false); // still PENDING

    ticket.matchTransaction('tx_1');
    expect(ticket.expectedReaction).toBe('MATCHED');
    expect(ticket.isReactionOutdated).toBe(true);
  });
});
