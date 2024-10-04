import { HealthService } from '@letta-web/letta-agents-api';

export async function getIsLocalServiceOnline() {
  try {
    return await HealthService.healthCheck();
  } catch (_e) {
    return false;
  }
}
