import { extractPythonArgDescription } from '../extractPythonArgDescription/extractPythonArgDescription';

interface Args {
  name: string;
  type: string;
  description?: string;
}

interface FunctionConfig {
  name: string;
  args: Args[];
  returnType: string;
  description: string;
}

/*

Python example:

def add(a: int, b: int) -> int:
  """
  Adds two numbers together
  """
  return a + b

def multiline(
  a: int,
  b: int,
  c: int
) -> int:
  """
  Adds three numbers together

  Args:
    a (int): The first number
    b (int): The second number
  """
  return a + b + c

def no_args() -> None:
  """
  Function with no arguments
  """
  pass

def no_description(a: int) -> int:
  return a

def ambiguous_return_value(a: int):
  return a
 */
export function pythonCodeParser(pythonCode: string) {
  const functions: FunctionConfig[] = [];
  const functionRegex =
    // eslint-disable-next-line no-useless-escape
    /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\)(?:\s*->\s*([a-zA-Z0-9_\[\], ]*))?\s*:\s*(?:"""([\s\S]*?)""")?/g;

  let match;
  while ((match = functionRegex.exec(pythonCode)) !== null) {
    const name = match[1];
    const argsString = match[2].trim();
    const returnType = match[3] || 'any';
    const description = match[4] ? match[4].trim() : '';

    // only take the first line of the description
    const functionDescription = description.split('\n')[0];

    // lookup arguments in description
    const argDescriptionMap = extractPythonArgDescription(pythonCode);

    // Parse arguments
    const args: Args[] = [];
    if (argsString) {
      // Split by commas, but ignore commas inside brackets
      const argsList = argsString
        .split(/,(?![^[\]]*\])/)
        .map((arg) => arg.trim());
      for (const arg of argsList) {
        const [argNameAndType] = arg.split('=').map((part) => part.trim());
        const argParts = argNameAndType.split(':');
        const argName = argParts[0].trim();
        let argType = 'any';

        if (argParts.length > 1) {
          argType = argParts[1].trim();

          // Handle complex types like dict[str, str]
          const complexTypeRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\[[^\]]+\])?$/;
          if (!complexTypeRegex.test(argType)) {
            argType = 'any'; // Fallback to 'any' if the type is invalid
          }
        }

        if (argName && argName !== 'self') {
          args.push({
            name: argName,
            type: argType,
            description: argDescriptionMap[argName]?.description,
          });
        }
      }
    }

    functions.push({
      name,
      args,
      returnType,
      description: functionDescription,
    });
  }

  return functions;
}
