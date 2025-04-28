import type {
  ParameterProperties,
  ToolJSONSchema,
} from '@letta-cloud/sdk-core';
import { pythonCodeParser } from '../pythonCodeParser/pythonCodeParser';
import { get } from 'lodash';

export const jsonSchemaTypeMap: Record<string, string> = {
  str: 'string',
  int: 'integer',
  float: 'number',
  bool: 'boolean',
};

export const ADD_DESCRIPTION_PLACEHOLDER = '<please add a description>';
export const RESTRICTED_PROPS = [
  'agent_state',
  'cls',
  'request_heartbeat',
  'self',
];

export function generateJSONSchemaFromCode(
  code: string,
  existingSchema?: ToolJSONSchema,
): ToolJSONSchema | null {
  const functionConfigs = pythonCodeParser(code);
  const lastConfig = functionConfigs[functionConfigs.length - 1];
  const existingArgs = get(
    existingSchema,
    'parameters.properties',
    {},
  ) as ToolJSONSchema['parameters']['properties'];

  if (!lastConfig) {
    return null;
  }

  return {
    name: lastConfig.name,
    description: lastConfig.description,
    parameters: {
      type: 'object',
      properties: {
        ...lastConfig.args
          .filter((arg) => !RESTRICTED_PROPS.includes(arg.name))
          .reduce(
            (acc, arg) => {
              let description =
                existingArgs[arg.name]?.description || arg?.description;

              if (description === ADD_DESCRIPTION_PLACEHOLDER) {
                description = arg?.description;
              }

              if (!description) {
                description = ADD_DESCRIPTION_PLACEHOLDER;
              }

              acc[arg.name] = {
                type: jsonSchemaTypeMap[arg.type] || arg.type,
                description: description,
              };
              return acc;
            },
            {} as Record<string, ParameterProperties>,
          ),
      },
      required: [
        ...lastConfig.args
          .filter((arg) => !RESTRICTED_PROPS.includes(arg.name))
          .map((arg) => arg.name),
      ],
    },
  };
}
