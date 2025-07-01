import { contracts, queryClientKeys } from './lib/web-api-contracts';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

export * from './lib/hooks/useFeatureFlag/useFeatureFlag';
export * from './lib/hooks/useSetOnboardingStep/useSetOnboardingStep';
export * from './lib/hooks/usePauseOnboarding/usePauseOnboarding';
export * from './lib/hooks/useUnpauseOnboarding/useUnpauseOnboarding';

export * from './lib/web-api-contracts';
export * from './lib/types';

function getExternalUrl() {
  return process.env.NODE_ENV === 'production'
    ? 'https://app.letta.com/api'
    : 'http://localhost:3000/api';
}

const baseUrl = (() => {
  if (CURRENT_RUNTIME === 'letta-desktop') {
    return getExternalUrl();
  }

  return '/api';
})();

export const webApiContracts = contracts;
export const webApi = initTsrReactQuery(contracts, {
  baseUrl,
});

export const externalWebApi = initTsrReactQuery(contracts, {
  baseUrl: getExternalUrl(),
});

export const webApiQueryKeys = queryClientKeys;
