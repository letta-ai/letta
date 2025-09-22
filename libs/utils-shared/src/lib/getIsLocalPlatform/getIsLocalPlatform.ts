import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

export function getIsLocalPlatform() {
  if (CURRENT_RUNTIME === 'letta-desktop' || CURRENT_RUNTIME === 'letta-docker-enterprise') {
    return true;
  }

  return false;
}
