import type { ComputeCoreMemoryWorkerPayload } from '../../types';
import { isArray, isObject } from 'lodash-es';

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
  self.pyodide = await loadPyodide();
  await self.pyodide.loadPackage(['jinja2']);
}

const pyodideReadyPromise = loadPyodideAndPackages();

function createDict(object: Record<string, unknown>) {
  const obj = Object.entries(object)
    .map(([key, value]): string => {
      if (!value) {
        return '';
      }

      if (typeof value === 'string') {
        return `'${key}': """${value.replace(/"/g, '\\"')}"""`;
      }

      if (typeof value === 'number') {
        return `'${key}':${value}`;
      }

      if (typeof value === 'boolean') {
        return `'${key}':${value ? 'True' : 'False'}`;
      }

      if (isArray(value)) {
        return '';
      }

      if (isObject(value)) {
        return `'${key}': ${createDict(value as Record<string, unknown>)}`;
      }

      return '';
    })
    .filter((v) => !!v)
    .join(',');

  return `{${obj}}`;
}

self.onmessage = async (
  event: MessageEvent<ComputeCoreMemoryWorkerPayload>
) => {
  // make sure loading is done
  await pyodideReadyPromise;

  const { templateString, context } = event.data;

  const python = `from jinja2 import Template

template = Template('${templateString.replace(/(\r\n|\n|\r)/gm, '')}')

# generate memories dict from context

memory = [${context.memory.map((m) => createDict(m)).join(',')}]

template.render(blocks=memory)
`;

  const results = await self.pyodide.runPythonAsync(python);
  self.postMessage(results);
};
