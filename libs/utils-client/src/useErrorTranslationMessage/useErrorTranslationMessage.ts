import type { AppRoute, ServerInferResponseBody } from '@ts-rest/core';
import { isErrorResponse } from '@ts-rest/core';
import { useMemo } from 'react';
import { get } from 'lodash-es';

interface ServerWithError<T extends string> {
  errorCode: T;
}

interface UseErrorTranslationMessageOptions<T extends AppRoute> {
  contract: T;
  // If the server response has an error code, this map will be used to translate the error message.
  // otherwise we will return undefined, which means the error message is unknown.
  messageMap: ServerInferResponseBody<T, 400> extends ServerWithError<string>
    ? Record<ServerInferResponseBody<T, 400>['errorCode'], React.ReactNode> & {
        default: string;
      }
    : undefined;
}

export function useErrorTranslationMessage<T extends AppRoute>(
  error: unknown,
  options: UseErrorTranslationMessageOptions<T>,
) {
  return useMemo(() => {
    if (!error) {
      return undefined;
    }

    let translationKey: string | undefined = 'default' as const;

    if (isErrorResponse(error)) {
      if (Object.prototype.hasOwnProperty.call(error.body, 'errorCode')) {
        translationKey = error.body.errorCode as string;
      }
    }

    if (!options.messageMap) {
      throw new Error('messageMap is required');
    }

    const message = get(
      options.messageMap,
      translationKey,
      options.messageMap.default,
    );

    return {
      message,
      errorCode: translationKey,
    };
  }, [error, options.messageMap]);
}
