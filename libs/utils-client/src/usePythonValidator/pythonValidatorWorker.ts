import registerPromiseWorker from 'promise-worker/register';
import type { GetMessagesWorkerPayload } from '../types';
import type {
  PythonValidatorError,
  PythonValidatorWorkerResponse,
} from './types';

declare global {
  // eslint-disable-next-line no-var
  var importScripts: (str: string) => void;
  // eslint-disable-next-line no-var
  var pyodide: any;
  // eslint-disable-next-line no-var
  var loadPyodide: any;
}

try {
  importScripts('https://cdn.jsdelivr.net/pyodide/dev/full/pyodide.js');
} catch (_e) {
  console.warn('Failed to import pyodide.js');
}
async function loadPyodideAndPackages() {
  if (!self.loadPyodide) {
    return;
  }

  self.pyodide = await loadPyodide();
}

const pyodideReadyPromise = loadPyodideAndPackages();

registerPromiseWorker(
  async (
    message: GetMessagesWorkerPayload,
  ): Promise<PythonValidatorWorkerResponse> => {
    if (!self.pyodide) {
      return { errors: [] };
    }

    await pyodideReadyPromise;

    let errors: PythonValidatorError[] = [];

    try {
      await self.pyodide.runPythonAsync(message.code);
    } catch (e) {
      console.log(e);

      if (e instanceof Error) {
        const fileRexp = /File "<exec>", line (\d+)/;
        const detectedRexp = /detected at line (\d+)/;
        const errorRexp = /Error: (.+)/;

        let line = fileRexp.exec(e.message)?.[1];

        // check if e.message.match(/detected at line (\d+)/)?.[1]; is also valid, this takes precedence over the above line
        if (detectedRexp.test(e.message)) {
          line = detectedRexp.exec(e.message)?.[1];
        }

        if (line) {
          const message = errorRexp.exec(e.message)?.[1] || '';

          if (message.includes('triple-quoted string')) {
            line = `${parseInt(line, 10) - 2}`;
          }

          if (line && message) {
            errors = [
              {
                line: parseInt(line, 10),
                message,
              },
            ];
          }
        }
      }
    }

    return { errors };
  },
);
