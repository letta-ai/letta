import { getUsageLimits } from '@letta-cloud/utils-shared';

export function getUseProvidersServiceModelsStandardArgs() {
  return {
    limit: getUsageLimits('free').providers,
  };
}
