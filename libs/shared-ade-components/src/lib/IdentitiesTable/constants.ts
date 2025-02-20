import { UseIdentitiesServiceListIdentitiesKeyFn } from '@letta-cloud/letta-agents-api';

export function UseInfiniteIdentitiesQueryFn(
  args: Parameters<typeof UseIdentitiesServiceListIdentitiesKeyFn>,
) {
  return ['infinite', ...UseIdentitiesServiceListIdentitiesKeyFn(...args)];
}
