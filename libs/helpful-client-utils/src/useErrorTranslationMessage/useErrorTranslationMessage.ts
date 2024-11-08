import { isErrorResponse } from '@ts-rest/core';
import { useMemo } from 'react';

export function useErrorTranslationMessage(
  error: unknown,
  messageMap: Record<string, string> & { default: string }
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

    return messageMap[translationKey] ?? messageMap.default;
  }, [error]);
}
