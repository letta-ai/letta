import { isErrorResponse } from '@ts-rest/core';

export function createErrorTranslationFinder() {
  return function finder(error: unknown) {
    if (isErrorResponse(error)) {
      if (Object.prototype.hasOwnProperty.call(error.body, 'errorCode')) {
        return error.body.errorCode as string;
      }
    }

    return 'default' as const;
  };
}
