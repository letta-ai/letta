// given a streamed JSON object, return data as follows
/*
  Record<string, string>
 */
import type { TsRestRequest } from '@ts-rest/serverless/next.cjs';

type StreamedDataOutput = Record<string, string>;

interface StreamedArgumentsParserGeneratorOptions {
  dataTransfer?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- DataTransfer API has complex types
}

export interface GeneralRequestContext {
  request: TsRestRequest;
}

export function streamedArgumentsParserGenerator() {
  let keyBuffer = '';
  let prevText = '';
  let insideString = false;
  let step: 'between' | 'edge' | 'key' | 'value' = 'edge';
  let output: StreamedDataOutput = {};

  function reader(
    text: string,
    onMessage: (
      data: StreamedDataOutput,
      options: StreamedArgumentsParserGeneratorOptions,
    ) => void,
    options: StreamedArgumentsParserGeneratorOptions = {},
  ) {
    // when we first encounter the " character after edge state, we start reading the key
    if (step === 'edge' && text.trim() === '"') {
      step = 'key';

      return;
    }

    if (step === 'key') {
      if (!text.trim().includes('"')) {
        if (/[A-Za-z0-9]/.test(text)) {
          keyBuffer += text;
        }
      } else {
        step = 'between';

        return;
      }
    }

    // when we encounter a character that is not a space or a colon, we start reading the value
    if (step === 'between' && ![' ', ':'].includes(text.trim())) {
      step = 'value';

      if (text.trim() === '"') {
        insideString = true;
        return;
      }
    }

    if (step === 'value') {
      if (
        (['"', ',', '}', '"}'].includes(text.trim()) && prevText !== '\\') ||
        text.trim().endsWith('"')
      ) {
        if (text === '"') {
          insideString = false;
        }

        if (insideString && ['}', ','].includes(text.trim())) {
          output[keyBuffer] = text;
          prevText = text;
          onMessage(output, options);
          return;
        }

        if (text.trim().endsWith('"')) {
          const dataBeforeEndQuote = text.trim().slice(0, -1);

          if (dataBeforeEndQuote) {
            output[keyBuffer] = dataBeforeEndQuote;
            prevText = text;
            onMessage(output, options);
          }
        }

        keyBuffer = '';
        prevText = '';
        output = {};
        step = 'edge';
        return;
      } else {
        output[keyBuffer] = text;
        prevText = text;
        onMessage(output, options);

        return;
      }
    }
  }

  function clear() {
    keyBuffer = '';
    step = 'edge';
    output = {};
  }

  return {
    reader,
    clear,
  };
}

export function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export * from '$web/server/lib/getLettaAgentsInferenceModelsSingleton/getLettaAgentsInferenceModelsSingleton';
