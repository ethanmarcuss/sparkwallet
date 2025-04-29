export enum CurrencyType {
  FIAT = "FIAT",
  BLOCKCHAIN = "BLOCKCHAIN",
}

export interface Currency {
  name: string;
  code: string;
  decimals: number;
  type: CurrencyType;
  balance?: number;
  symbol: string;
}

export const DEFAULT_USD_CURRENCY: Currency = {
  name: "US Dollar",
  code: "USD",
  decimals: 2,
  type: CurrencyType.FIAT,
  symbol: "$",
};

export const DEFAULT_BTC_CURRENCY: Currency = {
  name: "Bitcoin",
  code: "BTC",
  decimals: 8,
  type: CurrencyType.BLOCKCHAIN,
  balance: 0,
  symbol: "₿",
};

export const PERMANENT_CURRENCIES: Map<string, Currency> = new Map([
  [
    "BTC",
    {
      name: "Bitcoin",
      code: "BTC",
      decimals: 8,
      type: CurrencyType.BLOCKCHAIN,
      balance: 1231,
      symbol: "₿",
    },
  ],
  [
    "USD",
    {
      name: "US Dollar",
      code: "USD",
      decimals: 2,
      type: CurrencyType.FIAT,
      symbol: "$",
    },
  ],
]);

export const getCurrency = (
  map: Map<string, Currency>,
  key: string,
  defaultValue: Currency
): Currency => {
  return map.get(key) ?? defaultValue;
};
