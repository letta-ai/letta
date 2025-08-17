import type {  VariableStoreVersionOneType } from '@letta-cloud/types';

export function convertRecordMemoryVariablesToMemoryVariablesV1(
  memoryVariables: Record<string, string>,
): VariableStoreVersionOneType {
  return {
    data: Object.entries(memoryVariables).map(([key, defaultValue]) => ({
      key,
      defaultValue,
      type: 'string',
    })),
    version: '1',
  };
}


export function convertMemoryVariablesV1ToRecordMemoryVariables(
  memoryVariables: VariableStoreVersionOneType,
): Record<string, string> {
  return memoryVariables.data.reduce((acc, variable) => {
    acc[variable.key] = variable.defaultValue || '';
    return acc;
  }, {} as Record<string, string>);
}
