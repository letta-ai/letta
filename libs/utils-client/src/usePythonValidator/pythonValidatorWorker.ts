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
  // Lock down stable version of Pyodide to guarantee stability with imports.
  importScripts(
    'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js',
  );
} catch (_e) {
  console.warn('Failed to import pyodide.js');
}
async function loadPyodideAndPackages() {
  if (!self.loadPyodide) {
    return;
  }

  self.pyodide = await loadPyodide();
  await self.pyodide.loadPackage(['pydantic']);
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

    const preCode = `from pydantic import BaseModel, Field
from typing import Any, Dict, List, Literal, Optional, Tuple, Union`;

    try {
      await self.pyodide.runPythonAsync(`${preCode}\n${message.code}`);
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

        let parsedLine = parseInt(line || '', 10) - preCode.split('\n').length;

        if (line) {
          const message = errorRexp.exec(e.message)?.[1] || '';

          if (message.includes('triple-quoted string')) {
            parsedLine = parsedLine - 2;
          }

          if (line && message) {
            errors = [
              {
                line: parsedLine,
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
