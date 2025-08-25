export function parseMessageFromPartialJson(input: string) {
  if (!input) {
    return null;
  }

  // Remove whitespace and normalize
  const trimmed = input.trim();

  // Look for "message" key using regex
  // This pattern matches: "message" followed by : and then captures the value
  const messagePattern = /"message"\s*:\s*"([^"]*)"/;
  const match = trimmed.match(messagePattern);

  if (match) {
    return unescapeJsonString(match[1]); // Unescape the captured value
  }

  // If no complete quoted value found, try to extract partial value
  // Look for "message": " followed by any characters until end of string or next quote
  const partialPattern = /"message"\s*:\s*"([^"]*)/;
  const partialMatch = trimmed.match(partialPattern);

  if (partialMatch) {
    return unescapeJsonString(partialMatch[1]); // Unescape the partial value
  }

  // No "message" key found
  return null;
}

function unescapeJsonString(str: string): string {
  return str.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_match, sequence) => {
    if (sequence.startsWith('u')) {
      // Handle Unicode escape sequences like \u1234
      const hexCode = sequence.slice(1);
      return String.fromCharCode(parseInt(hexCode, 16));
    }

    switch (sequence) {
      case '"':
        return '"';
      case '\\':
        return '\\';
      case '/':
        return '/';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return sequence; // For any other escaped character, just return the character
    }
  });
}
