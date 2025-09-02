import 'remote-web-worker';
import PromiseWorker from 'promise-worker';
import { useCallback } from 'react';

let worker: Worker;

if (typeof Worker !== 'undefined') {
  worker = new Worker(new URL('./pythonValidatorWorker.ts', import.meta.url));
}

export function usePythonValidator() {
  const validatePython = useCallback(async (code: string) => {
    const promiseWorker = new PromiseWorker(worker);

    return promiseWorker.postMessage({ code });
  }, []);

  return {
    validatePython,
  };
}
