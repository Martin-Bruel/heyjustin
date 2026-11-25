# 012: The receipt is attached to a Pennylane supplier before the recap

Date: 2026-11-25 · Status: accepted

## Context

The supplier printed on a receipt ("easyJet Airline Company Limited") rarely
has the exact name of the company's supplier in Pennylane ("easyJet").
Creating a supplier per spelling would split the accounting.

## Decision

- **Before the recap**, so the user validates the supplier too: the recap
  shows `easyJet (existing in Pennylane)` or `<printed name> (new in Pennylane)`.
- **In the extraction call**: the company's suppliers are listed with the
  receipt (`id | name | VAT number | SIREN`, ~15 tokens each), and the model
  answers `matchedSupplierId`. One AI call, no second model. Above 1000
  suppliers the list is not sent (cost, reliability).
- **The AI reports, the code decides** (`receipts/services/supplier-matcher.service.ts`,
  identifiers normalized in `receipts/models/supplier-identifiers.ts`):
  1. a VAT number or SIREN read on the receipt that matches exactly one
     supplier wins, whatever the AI chose (and works without the list);
  2. otherwise the AI's choice, only if it is an id that was sent and no
     printed identifier contradicts it;
  3. otherwise a new supplier.
- **Identifiers read on the receipt**: the supplier's VAT number and SIREN
  (or SIRET, of which the SIREN is kept; a French VAT number contains the
  SIREN). Normalized, dropped when malformed. They are sent to Pennylane at
  creation only when read: Pennylane requires only the name, and no lookup
  is made elsewhere (a SIREN found by name could be the wrong company).
- **No mapping table**: the suppliers are listed from Pennylane at each
  receipt (1 request per 100 suppliers).
- Without a Pennylane token, or when the list cannot be loaded, the ticket
  fails before the AI call: without the list a known supplier would be
  created again.

## Consequences

- Each receipt costs a few Pennylane requests and more input tokens (~0.005 $
  for 500 suppliers with Mistral Large 4).
- Most receipts (tickets de caisse) print no identifier: the match then
  rests on the AI, checked by the user on the recap.
- The matched supplier is stored on the ticket (`matchedSupplierId`,
  `matchedSupplierName`) until the import.
