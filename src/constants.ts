export const SYMBOL_PRECISION: Record<string, number> = {
  BTCUSD: 1,
  ETHUSD: 2,
  XRPUSD: 4,
  SOLUSD: 4,
  PAXGUSD: 2,
  DOGEUSD: 6,
};

export function groupingOptionsFor(symbol: string): number[] {
  const prec = SYMBOL_PRECISION[symbol] ?? 2;
  // base increments depending on precision
  switch (symbol) {
    case 'BTCUSD':
      return [1, 5, 10, 50, 100, 500];
    case 'ETHUSD':
      return [0.5, 1, 5, 10, 50];
    case 'XRPUSD':
      return [0.0001, 0.001, 0.01, 0.1];
    default:
      if (prec <= 1) return [1, 5, 10];
      return [Math.pow(10, -prec), Math.pow(10, -prec+1)];
  }
}
