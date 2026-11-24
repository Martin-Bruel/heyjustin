import { SourceMessage } from '../models/source-message.js';
import type { Ticket as TicketRow } from '../../prisma/index.js';
import { Extraction } from '../../receipts/index.js';
import { PennylaneInfo } from '../models/pennylane-info.js';
import { Ticket } from '../models/ticket.js';
import { InconsistentTicketRowError } from './inconsistent-ticket-row.error.js';
import { toTicket, toTicketRow } from './ticket-row.mapper.js';

const extraction = new Extraction(
  'Acme',
  new Date('2026-11-01'),
  1200,
  200,
  'EUR',
);
const pennylane = new PennylaneInfo('sup_1', 'inv_1');

const newTicket = () =>
  Ticket.create({
    id: 't1',
    companyId: 'c1',
    userId: 'u1',
    source: new SourceMessage('WHATSAPP', 'wamid.1'),
    caption: 'lunch',
  });

/** What Prisma would return for a saved ticket. */
const asRow = (ticket: Ticket): TicketRow => ({
  ...toTicketRow(ticket),
  updatedAt: new Date(),
});

describe('ticket row mapper', () => {
  it('round-trips a RECEIVED ticket with empty columns', () => {
    const ticket = newTicket();
    const row = asRow(ticket);

    expect(row.totalCents).toBeNull();
    expect(row.pennylaneInvoiceId).toBeNull();
    expect(toTicket(row).state).toEqual({ status: 'RECEIVED' });
  });

  it('round-trips a MATCHED ticket with all its data', () => {
    const ticket = newTicket();
    ticket.recordExtraction(extraction);
    ticket.recordPennylaneImport(pennylane);
    ticket.matchTransaction('tx_1');
    ticket.markReactionAsDisplayed('MATCHED');

    const restored = toTicket(asRow(ticket));

    expect(restored.state).toEqual(ticket.state);
    expect(restored.displayedReaction).toBe('MATCHED');
    expect(restored.caption).toBe('lunch');
  });

  it('round-trips a FAILED ticket, with or without extraction', () => {
    const early = newTicket();
    early.fail('unreadable');
    expect(toTicket(asRow(early)).state).toEqual(early.state);

    const late = newTicket();
    late.recordExtraction(extraction);
    late.fail('pennylane down');
    expect(toTicket(asRow(late)).state).toEqual(late.state);
  });

  it('rejects a row whose columns do not match its status', () => {
    const row: TicketRow = {
      ...asRow(newTicket()),
      status: 'MATCHED',
    };
    expect(() => toTicket(row)).toThrow(InconsistentTicketRowError);
    expect(() => toTicket(row)).toThrow(/status MATCHED but supplierName/);
  });
});
