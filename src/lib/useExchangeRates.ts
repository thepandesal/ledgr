import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

type RateMap = Record<string, Record<string, number>>;

export function useExchangeRates() {
  const { data: rateMap = {} } = useQuery<RateMap>({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('exchange_rates')
        .select('base, target, rate');
      const map: RateMap = {};
      for (const row of data ?? []) {
        if (!map[row.base]) map[row.base] = {};
        map[row.base][row.target] = Number(row.rate);
      }
      return map;
    },
    staleTime: 1000 * 60 * 60, // cache for 1 hour
  });

  const convert = (amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    const rate = rateMap[from]?.[to];
    if (!rate) return amount; // fallback: no conversion if rate missing
    return amount * rate;
  };

  const hasRates = Object.keys(rateMap).length > 0;

  return { convert, hasRates, rateMap };
}
