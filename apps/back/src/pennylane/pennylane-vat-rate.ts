/**
 * Pennylane's VAT codes we produce. Pennylane has one code per country and
 * rate (`FR_200` is 20% in France, `DE_190`…), plus `exempt`, `mixed`…
 * Pennylane may add codes: we only send these.
 */
export type PennylaneVatRate =
  'FR_200' | 'FR_100' | 'FR_85' | 'FR_55' | 'FR_21' | 'exempt' | 'mixed';

/** French rates (mainland and overseas), by rate in basis points. */
const FRENCH_RATES: ReadonlyMap<number, PennylaneVatRate> = new Map([
  [2000, 'FR_200'],
  [1000, 'FR_100'],
  [850, 'FR_85'],
  [550, 'FR_55'],
  [210, 'FR_21'],
  [0, 'exempt'],
]);

/**
 * Pennylane's code for a French VAT rate, `null` when the rate is not French
 * (a receipt from abroad) or unknown: a receipt only gives a rate, not the
 * country's tax rules, so we do not guess.
 */
export function frenchVatRate(
  rateBasisPoints: number | null,
): PennylaneVatRate | null {
  return rateBasisPoints === null
    ? null
    : (FRENCH_RATES.get(rateBasisPoints) ?? null);
}
