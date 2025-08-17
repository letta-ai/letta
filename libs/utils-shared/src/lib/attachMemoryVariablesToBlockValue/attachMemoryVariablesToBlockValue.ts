export function attachMemoryVariablesToBlockValue(
  value: string,
  variables: Record<string, string>,
) {
  return value.replace(/{{(.*?)}}/g, (_m, p1) => {
    return variables?.[p1] || '';
  });
}
