import { useState, useEffect, useMemo } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  usePythonValidator,
  type PythonValidatorError,
} from '@letta-cloud/utils-client';

export function useToolValidation(sourceCode: string) {
  const [validationErrors, setValidationErrors] = useState<
    PythonValidatorError[]
  >([]);
  const { validatePython } = usePythonValidator();
  const [debouncedCode] = useDebouncedValue(sourceCode || '', 500);

  useEffect(() => {
    if (validatePython) {
      void validatePython(debouncedCode).then(({ errors }) => {
        setValidationErrors(errors);
      });
    }
  }, [debouncedCode, validatePython]);

  const validationErrorsToLineNumberMap = useMemo(() => {
    return validationErrors.reduce((acc, error) => {
      if (!error.line) {
        return acc;
      }

      return {
        ...acc,
        [error.line]: error.message,
      };
    }, {});
  }, [validationErrors]);

  return {
    validationErrors,
    validationErrorsToLineNumberMap,
  };
}
