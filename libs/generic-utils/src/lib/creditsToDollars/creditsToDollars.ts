// 1 credit = $0.001
export function creditsToDollars(credits: number): number {
  return credits * 0.001;
}

export function dollarsToCredits(dollars: number): number {
  return dollars * 1000;
}
