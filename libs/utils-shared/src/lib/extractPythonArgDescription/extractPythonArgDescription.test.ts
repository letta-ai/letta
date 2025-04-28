import { extractPythonArgDescription } from './extractPythonArgDescription';

describe('extractPythonArgDescription', () => {
  it('should return an empty object if no docstring is present', () => {
    const pythonCode = `
def testFunction(arg1, arg2):
    pass
    `;

    const result = extractPythonArgDescription(pythonCode);
    expect(result).toEqual({});
  });

  it('should extract argument descriptions from a docstring with Args section', () => {
    const pythonCode = `
def testFunction(arg1: str, arg2: int):
    """
    A test function.

    Args:
        arg1 (str): The first argument.
        arg2 (int): The second argument.
    """
    pass
    `;

    const result = extractPythonArgDescription(pythonCode);
    expect(result).toEqual({
      arg1: { type: 'str', description: 'The first argument.' },
      arg2: { type: 'int', description: 'The second argument.' },
    });
  });

  it('should handle missing types in the docstring', () => {
    const pythonCode = `
def testFunction(arg1, arg2):
    """
    A test function.

    Args:
        arg1: The first argument.
        arg2: The second argument.
    """
    pass
    `;

    const result = extractPythonArgDescription(pythonCode);
    expect(result).toEqual({
      arg1: { type: undefined, description: 'The first argument.' },
      arg2: { type: undefined, description: 'The second argument.' },
    });
  });

  it('should handle docstrings without an Args section', () => {
    const pythonCode = `
def testFunction(arg1, arg2):
    """
    A test function.
    """
    pass
    `;

    const result = extractPythonArgDescription(pythonCode);
    expect(result).toEqual({});
  });

  it('should handle multiline descriptions for arguments', () => {
    const pythonCode = `
def testFunction(arg1: str, arg2: int):
    """
    A test function.

    Args:
        arg1 (str): The first argument.
            This is a multiline description.
        arg2 (int): The second argument.
    """
    pass
    `;

    const result = extractPythonArgDescription(pythonCode);
    expect(result).toEqual({
      arg1: { type: 'str', description: 'The first argument.' },
      arg2: { type: 'int', description: 'The second argument.' },
    });
  });

  it('should handle arguments with no description', () => {
    const pythonCode = `
def testFunction(arg1: str, arg2: int):
    """
    A test function.

    Args:
        arg1(str): The first argument.
        arg2(int): The second argument.
    """
    pass
    `;

    const result = extractPythonArgDescription(pythonCode);
    expect(result).toEqual({
      arg1: { type: 'str', description: 'The first argument.' },
      arg2: { type: 'int', description: 'The second argument.' },
    });
  });
});
