import { useState, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface CurrencyBarProps {
  foreignCurrency: string; // e.g. "JPY"
  homeCurrency: string; // e.g. "TWD"
  amount: number; // The foreign amount to convert
}

const RATES_CACHE_KEY = 'gosavor_exchange_rates';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

const getCurrencyCode = (symbol: string): string => {
  const map: Record<string, string> = {
    '¥': 'JPY', '￥': 'JPY', '$': 'USD', '€': 'EUR',
    '₩': 'KRW', '฿': 'THB', '£': 'GBP',
  };
  return map[symbol] || symbol;
};

const fetchRates = async (base: string): Promise<Record<string, number>> => {
  // Check cache first
  try {
    const cached = localStorage.getItem(RATES_CACHE_KEY);
    if (cached) {
      const data: CachedRates = JSON.parse(cached);
      if (Date.now() - data.timestamp < CACHE_TTL && data.rates[base]) {
        return data.rates;
      }
    }
  } catch { /* ignore */ }

  // Fetch from free API
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`);
    const data = await res.json();
    const rates = data[base.toLowerCase()] || {};
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, timestamp: Date.now() }));
    return rates;
  } catch {
    return {};
  }
};

const CurrencyBar = ({ foreignCurrency, homeCurrency, amount }: CurrencyBarProps) => {
  const [rate, setRate] = useState<number | null>(null);

  const foreignCode = getCurrencyCode(foreignCurrency).toLowerCase();
  const homeCode = homeCurrency.toLowerCase();

  useEffect(() => {
    if (!foreignCode || !homeCode || foreignCode === homeCode) return;
    fetchRates(foreignCode).then(rates => {
      if (rates[homeCode]) {
        setRate(rates[homeCode]);
      }
    });
  }, [foreignCode, homeCode]);

  if (!rate || amount === 0) return null;

  const converted = Math.round(amount * rate);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <ArrowLeftRight size={12} />
      <span>
        ≈ {converted} {homeCurrency}
      </span>
    </div>
  );
};

export default CurrencyBar;
export { fetchRates, getCurrencyCode };
