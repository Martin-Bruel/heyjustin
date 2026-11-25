import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PennylaneClient } from './pennylane.client.js';
import { pennylaneConfig } from './pennylane.config.js';
import { PennylaneAccountService } from './services/pennylane-account.service.js';
import { PennylaneInvoicesService } from './services/pennylane-invoices.service.js';
import { PennylaneSuppliersService } from './services/pennylane-suppliers.service.js';

/**
 * The Pennylane API v2: technical, knows no ticket. Each call takes the
 * company's token (one token per company), so this module stores nothing.
 */
@Module({
  imports: [ConfigModule.forFeature(pennylaneConfig)],
  providers: [
    PennylaneClient,
    PennylaneAccountService,
    PennylaneSuppliersService,
    PennylaneInvoicesService,
  ],
  exports: [
    PennylaneAccountService,
    PennylaneSuppliersService,
    PennylaneInvoicesService,
  ],
})
export class PennylaneModule {}
