import { jsonrepair } from 'jsonrepair';
import { get } from 'lodash-es';

function tryFallbackParseJson(str: string): unknown {
  let trimmed = str;

  while (trimmed.length > 0) {
    try {
      return JSON.parse(jsonrepair(trimmed));
    } catch (_e) {
      trimmed = trimmed.slice(0, -1);
    }
  }

  return null;
}

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return tryFallbackParseJson(str);
  }
}

export function parseMessageFromPartialJson(input: string) {
  if (!input) {
    return null;
  }

  return get(safeParseJSON(input), 'message');
}
