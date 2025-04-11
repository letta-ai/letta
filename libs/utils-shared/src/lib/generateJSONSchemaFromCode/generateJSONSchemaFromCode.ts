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
        ...lastConfig.args.reduce(
          (acc, arg) => {
            acc[arg.name] = {
              type: jsonSchemaTypeMap[arg.type] || arg.type,
              description:
                existingArgs[arg.name]?.description ||
                ADD_DESCRIPTION_PLACEHOLDER,
            };
            return acc;
          },
          {} as Record<string, ParameterProperties>,
        ),
        request_heartbeat: {
          type: 'boolean',
          description:
            'Request an immediate heartbeat after function execution. Set to `True` if you want to send a follow-up message or run a follow-up function.',
        },
      },
      required: [
        ...lastConfig.args.map((arg) => arg.name),
        'request_heartbeat',
      ],
    },
  };
}
