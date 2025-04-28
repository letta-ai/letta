/**
 * VIBE CODED LOL
 * Extracts argument descriptions from Python function code or docstrings
 * @param {string} pythonCode - The Python function code or docstring
 * @returns {Object} - Map of argument names to their descriptions
 */
type ExtractPythonArgDescriptionResponse = Record<
  string,
  {
    type: string;
    description: string;
  }
>;

export function extractPythonArgDescription(
  pythonCode: string,
): ExtractPythonArgDescriptionResponse {
  // First, try to extract the docstring from the function definition
  const docstringMatch = /"""([\s\S]*?)"""/.exec(pythonCode);
  const docstring = docstringMatch ? docstringMatch[1] : pythonCode;

  // Find the Args section in the docstring
  const argsSectionMatch = docstring.split(/Args:\s*\n/i);
  const argsSection = argsSectionMatch.length > 1 ? argsSectionMatch[1] : '';

  // If no Args section is found, return empty object
  if (!argsSection) {
    return {};
  }

  // Create a regular expression to match argument patterns in the docstring
  // This pattern looks for lines like "  arg_name (type): Description or "arg_name: Description or "arg_name(type): Description"
  const argPattern =
    /\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]+)\))?\s*:\s*(.*)/g;

  const argDescriptionMap: ExtractPythonArgDescriptionResponse = {};
  let match;

  // Find all matches in the Args section
  while ((match = argPattern.exec(argsSection)) !== null) {
    const argName = match[1];
    const argType = match[2];
    const argDescription = match[3].trim();

    // Store in our map
    argDescriptionMap[argName] = {
      type: argType,
      description: argDescription,
    };
  }

  return argDescriptionMap;
}
