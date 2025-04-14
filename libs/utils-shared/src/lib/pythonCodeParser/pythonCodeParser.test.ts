import { pythonCodeParser } from './pythonCodeParser';

describe('pythonCodeParser', () => {
  it('should parse functions with arguments, return type, and description', () => {
    const pythonCode = `
      def add(a: int, b: int) -> int:
          """
          Adds two numbers together
          """
          return a + b
    `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'add',
        args: [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'int' },
        ],
        returnType: 'int',
        description: 'Adds two numbers together',
      },
    ]);
  });

  it('should handle functions with no arguments', () => {
    const pythonCode = `
      def no_args() -> None:
          """
          Function with no arguments
          """
          pass
    `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'no_args',
        args: [],
        returnType: 'None',
        description: 'Function with no arguments',
      },
    ]);
  });

  it('should handle functions with no description', () => {
    const pythonCode = `
      def no_description(a: int) -> int:
          return a
    `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'no_description',
        args: [{ name: 'a', type: 'int' }],
        returnType: 'int',
        description: '',
      },
    ]);
  });

  it('should handle functions with ambiguous return values', () => {
    const pythonCode = `
      def ambiguous_return_value(a: int):
          return a
    `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'ambiguous_return_value',
        args: [{ name: 'a', type: 'int' }],
        returnType: 'any',
        description: '',
      },
    ]);
  });

  it('should handle multiline arguments', () => {
    const pythonCode = `
      def multiline(
          a: int,
          b: int,
          c: int
      ) -> int:
          """
          Adds three numbers together
          """
          return a + b + c
    `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'multiline',
        args: [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'int' },
          { name: 'c', type: 'int' },
        ],
        returnType: 'int',
        description: 'Adds three numbers together',
      },
    ]);
  });

  it('should handle arguments with commas in their typedef like dict[str, int]', () => {
    const pythonCode = `
      def with_comma(a: dict[str, int], b: list[int]) -> None:
          """
          Function with arguments containing commas
          """
          pass
    `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'with_comma',
        args: [
          { name: 'a', type: 'dict[str, int]' },
          { name: 'b', type: 'list[int]' },
        ],
        returnType: 'None',
        description: 'Function with arguments containing commas',
      },
    ]);
  });

  it('should handle arguments with default values', () => {
    const pythonCode = `
    def with_defaults(a: int = 10, b: str = "default") -> str:
        """
        Function with default argument values
        """
        return f"{a} {b}"
  `;

    const result = pythonCodeParser(pythonCode);

    expect(result).toEqual([
      {
        name: 'with_defaults',
        args: [
          { name: 'a', type: 'int' },
          { name: 'b', type: 'str' },
        ],
        returnType: 'str',
        description: 'Function with default argument values',
      },
    ]);
  });
});
