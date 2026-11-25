import { Injectable } from '@nestjs/common';
import { PennylaneClient } from '../pennylane.client.js';
import type { PennylaneMeBody } from '../pennylane.types.js';

export interface PennylaneAccount {
  companyId: number;
  companyName: string;
  /** e.g. supplier_invoices:all; empty when Pennylane does not list them */
  scopes: string[];
}

/** Scopes the integration needs: read and write on these resources. */
export const REQUIRED_SCOPES = [
  'suppliers:all',
  'file_attachments:all',
  'supplier_invoices:all',
  'transactions:readonly',
] as const;

/** What a token gives access to, to check it before storing it. */
@Injectable()
export class PennylaneAccountService {
  constructor(private readonly pennylaneClient: PennylaneClient) {}

  async whoAmI(token: string): Promise<PennylaneAccount> {
    const me = await this.pennylaneClient.request<PennylaneMeBody>(token, {
      method: 'GET',
      path: '/me',
    });
    return {
      companyId: me.company.id,
      companyName: me.company.name,
      scopes: me.scopes ?? [],
    };
  }

  /** Required scopes the account lacks (`transactions:all` covers `:readonly`). */
  static missingScopes(account: PennylaneAccount): string[] {
    if (account.scopes.length === 0) return [];
    return REQUIRED_SCOPES.filter((scope) => {
      const resource = scope.split(':')[0];
      return (
        !account.scopes.includes(scope) &&
        !account.scopes.includes(`${resource}:all`)
      );
    });
  }
}
