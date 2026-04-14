export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
};

export const CURRENCY_CODES = Object.keys(SUPPORTED_CURRENCIES);

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES[code]?.symbol ?? code;
}

export function formatPrice(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${symbol}${formatted}`;
}

/**
 * Detect a reasonable default currency from browser locale.
 * Returns ISO currency code.
 */
export function detectCurrency(): string {
  try {
    // Priority 1: timezone-based detection (most reliable for actual location)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzMap: Record<string, string> = {
        'Africa/Johannesburg': 'ZAR',
        'America/New_York': 'USD', 'America/Chicago': 'USD', 'America/Denver': 'USD', 'America/Los_Angeles': 'USD',
        'Europe/London': 'GBP',
        'Australia/Sydney': 'AUD', 'Australia/Melbourne': 'AUD',
        'America/Toronto': 'CAD',
        'Europe/Berlin': 'EUR', 'Europe/Paris': 'EUR', 'Europe/Rome': 'EUR', 'Europe/Madrid': 'EUR', 'Europe/Amsterdam': 'EUR',
        'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR',
        'Asia/Dubai': 'AED',
        'Africa/Lagos': 'NGN',
        'Africa/Nairobi': 'KES',
        'Europe/Zurich': 'CHF',
      };
      if (tz && tzMap[tz]) {
        return tzMap[tz];
      }
    } catch { /* ignore */ }

    // Priority 2: locale-based detection (fallback — can be wrong if browser language ≠ location)
    const locale = navigator.language || '';
    const regionMap: Record<string, string> = {
      ZA: 'ZAR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD',
      DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
      AT: 'EUR', BE: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR',
      IN: 'INR', AE: 'AED', NG: 'NGN', KE: 'KES', CH: 'CHF',
    };
    const parts = locale.split('-');
    const region = parts.length > 1 ? parts[1].toUpperCase() : '';
    if (region && regionMap[region]) {
      return regionMap[region];
    }

    return 'USD';
  } catch {
    return 'USD';
  }
}

/**
 * Convert an amount from ZAR to target currency using a rates map.
 */
export function convertFromZAR(
  amountZAR: number,
  targetCurrency: string,
  rates: Record<string, number>
): number {
  if (targetCurrency === 'ZAR') return amountZAR;
  const rate = rates[targetCurrency];
  if (!rate) return amountZAR; // fallback
  return Math.round(amountZAR * rate * 100) / 100;
}

// Hardcoded fallback rates (approximate) in case API is down
export const FALLBACK_RATES: Record<string, number> = {
  USD: 0.055,
  EUR: 0.051,
  GBP: 0.044,
  AUD: 0.084,
  CAD: 0.075,
  CHF: 0.048,
  INR: 4.6,
  AED: 0.20,
  NGN: 85,
  KES: 7.1,
};
