import { isEqual } from 'lodash';
import type { AgentTemplateStateWithNoMetadata } from '../synchronizeSimulatedAgentWithAgentTemplate/synchronizeSimulatedAgentWithAgentTemplate';

export function compareAgentTemplateSchemaStates(
  syncData: AgentTemplateStateWithNoMetadata | null | undefined,
  schemaResponse: AgentTemplateStateWithNoMetadata | null | undefined,
): boolean {
  // Handle null/undefined cases
  if (!syncData && !schemaResponse) {
    return true;
  }

  if (!syncData || !schemaResponse) {
    return false;
  }

  return !isEqual(syncData, schemaResponse)
}
