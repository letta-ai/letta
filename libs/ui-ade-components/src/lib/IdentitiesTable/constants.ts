import { UseIdentitiesServiceListIdentitiesKeyFn } from '@letta-cloud/sdk-core';

export function UseInfiniteIdentitiesQueryFn(
  args: Parameters<typeof UseIdentitiesServiceListIdentitiesKeyFn>,
) {
  return ['infinite', ...UseIdentitiesServiceListIdentitiesKeyFn(...args)];
}
