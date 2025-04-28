import {
  generateJSONSchemaFromCode,
  ADD_DESCRIPTION_PLACEHOLDER,
} from './generateJSONSchemaFromCode';
import type { ToolJSONSchema } from '@letta-cloud/sdk-core';

describe('generateJSONSchemaFromCode', () => {
  it('should generate a JSON schema from the last function configuration', () => {
    const pythonCode = `
def testFunction(arg1: str, arg2: int):
    """
    A test function.

    Args:
      arg1 (str): Argument 1
      arg2 (int): Argument 2
    """
    pass
    `;

    const result = generateJSONSchemaFromCode(pythonCode);

    expect(result).toEqual({
      name: 'testFunction',
      description: 'A test function.',
      parameters: {
        type: 'object',
        properties: {
          arg1: { type: 'string', description: 'Argument 1' },
          arg2: { type: 'integer', description: 'Argument 2' },
        },
        required: ['arg1', 'arg2'],
      },
    });
  });

  it('should exclude specific arguments (self, cls, agent_state) from the schema', () => {
    const pythonCode = `
def testFunction(self, cls, agent_state, arg1: str):
    """
    A test function.

    Args:
      arg1 (str): Argument 1
    """
    pass
    `;

    const result = generateJSONSchemaFromCode(pythonCode);

    expect(result).toEqual({
      name: 'testFunction',
      description: 'A test function.',
      parameters: {
        type: 'object',
        properties: {
          arg1: { type: 'string', description: 'Argument 1' },
        },
        required: ['arg1'],
      },
    });
  });

  it('should add a placeholder description if none is provided', () => {
    const pythonCode = `
def testFunction(arg1: str):
    """
    A test function.

    :param arg1:
    """
    pass
    `;

    const result = generateJSONSchemaFromCode(pythonCode);

    expect(result).toEqual({
      name: 'testFunction',
      description: 'A test function.',
      parameters: {
        type: 'object',
        properties: {
          arg1: { type: 'string', description: ADD_DESCRIPTION_PLACEHOLDER },
        },
        required: ['arg1'],
      },
    });
  });

  it('should replace the placeholder description with the actual description if provided', () => {
    const pythonCode = `
def testFunction(arg1: str):
    """
    A test function.
    Args:
      arg1 (str): Argument 1
    """
    pass
    `;

    const existingSchema = {
      name: 'testFunction',
      description: 'A test function.',
      parameters: {
        properties: {
          arg1: { type: 'string', description: ADD_DESCRIPTION_PLACEHOLDER },
        },
      },
    } as ToolJSONSchema;

    const result = generateJSONSchemaFromCode(pythonCode, existingSchema);

    expect(result).toEqual({
      name: 'testFunction',
      description: 'A test function.',
      parameters: {
        type: 'object',
        properties: {
          arg1: { type: 'string', description: 'Argument 1' },
        },
        required: ['arg1'],
      },
    });
  });
});
