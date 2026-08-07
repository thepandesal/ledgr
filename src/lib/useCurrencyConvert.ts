import { useExchangeRates } from './useExchangeRates';
import { useUser } from '../hooks/useUser';

/**
 * Returns a `toDefault(amount, fromCurrency)` function that converts any
 * amount to the user's defaultCurrency using live exchange rates.
 *
 * Rules:
 * - If fromCurrency === defaultCurrency → no-op
 * - If rate is missing → return amount as-is (safe fallback)
 * - Caller is responsible for the paid-lock: pass the already-settled
 *   amount for completed transactions so it converts once and stays fixed.
 */
export function useCurrencyConvert() {
  const { defaultCurrency } = useUser();
  const { convert, hasRates } = useExchangeRates();

  const toDefault = (amount: number, fromCurrency?: string | null): number => {
    const from = fromCurrency ?? defaultCurrency;
    return convert(amount, from, defaultCurrency);
  };

  return { toDefault, defaultCurrency, hasRates };
}
