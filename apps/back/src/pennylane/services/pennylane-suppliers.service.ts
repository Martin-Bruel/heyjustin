import { Injectable, Logger } from '@nestjs/common';
import { PENNYLANE_LOG_EVENTS } from '../pennylane-log-events.js';
import { PennylaneClient } from '../pennylane.client.js';
import type { PennylaneSupplierBody } from '../pennylane.types.js';

export interface PennylaneSupplier {
  id: number;
  name: string;
  vatNumber: string | null;
  /** SIREN, 9 digits */
  regNo: string | null;
}

/** What we know of a new supplier: identifiers only when printed. */
export interface NewPennylaneSupplier {
  name: string;
  vatNumber: string | null;
  regNo: string | null;
}

/** Suppliers of a company in Pennylane. Which one a receipt belongs to is decided elsewhere. */
@Injectable()
export class PennylaneSuppliersService {
  private readonly logger = new Logger(PennylaneSuppliersService.name);

  constructor(private readonly pennylaneClient: PennylaneClient) {}

  /** Every supplier of the company (100 per request). */
  async list(token: string): Promise<PennylaneSupplier[]> {
    const suppliers = await this.pennylaneClient.listAll<PennylaneSupplierBody>(
      token,
      {
        path: '/suppliers',
      },
    );
    return suppliers.map(toSupplier);
  }

  async create(
    token: string,
    supplier: NewPennylaneSupplier,
  ): Promise<PennylaneSupplier> {
    const created = await this.pennylaneClient.request<PennylaneSupplierBody>(
      token,
      {
        method: 'POST',
        path: '/suppliers',
        json: {
          name: supplier.name,
          // optional for Pennylane: sent only when read on the receipt
          ...(supplier.vatNumber ? { vat_number: supplier.vatNumber } : {}),
          ...(supplier.regNo ? { reg_no: supplier.regNo } : {}),
        },
      },
    );
    this.logger.log('Pennylane supplier created', {
      event: PENNYLANE_LOG_EVENTS.supplierCreated,
      supplierId: created.id,
    });
    return toSupplier(created);
  }
}

function toSupplier(body: PennylaneSupplierBody): PennylaneSupplier {
  return {
    id: body.id,
    name: body.name,
    vatNumber: body.vat_number || null,
    regNo: body.reg_no || null,
  };
}
