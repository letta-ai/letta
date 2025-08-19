// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic utility function that transforms any object
export function camelCaseKeys(obj: any): any { // eslint-disable-line @typescript-eslint/no-explicit-any -- Input/output types must be flexible
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    acc[camelKey] = obj[key];
    return acc;
  }, {} as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- Accumulator type must match flexible return type
}
