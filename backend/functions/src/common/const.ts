// backend/functions/src/common/const.ts

export const ROLES_THAT_ADD = new Set(['admin', 'editor', 'staff']);
export const ROLES_CAN_DELETE = new Set(['admin', 'editor']); // For entry deletion
export const JOURNAL_COLLECTION = 'journals';

export const JOURNAL_TYPES = {
  BUSINESS: 'business',
} as const;

export const CURRENCY_OPTIONS: {
  [symbol: string]: { code: string; name: string; symbol: string };
} = {
  USD: { code: 'USD', name: 'United States Dollar', symbol: '$' },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
};
