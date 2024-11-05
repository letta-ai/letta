import type { AppRoute } from '@ts-rest/core';
import { isErrorResponse } from '@ts-rest/core';
import { isZodObjectStrict, isZodType } from '@ts-rest/core';

export function createErrorTranslationFinder(contract: AppRoute) {
  const map = Object.values(contract.responses).reduce((acc, response) => {
    // if errorCode is present add it to the map

    // unpack zod schema and extract literal from errorCode
    if (!isZodObjectStrict(response)) {
      return acc;
    }

    if (
      Object.prototype.hasOwnProperty.call(response._def.shape(), 'errorCode')
    ) {
      if (isZodType(response._def.shape().errorCode)) {
        if (typeof response._def.shape().errorCode._def.value === 'string') {
          acc[response._def.shape().errorCode._def.value] =
            response._def.shape().errorCode._def.value;
        }
      }
    }

    return acc;
  }, {} as Record<string, string>);

  return function finder(error: unknown) {
    if (isErrorResponse(error)) {
      if (Object.prototype.hasOwnProperty.call(error.body, 'errorCode')) {
        return map[error.body.errorCode];
      }
    }

    return 'default' as const;
  };
}
