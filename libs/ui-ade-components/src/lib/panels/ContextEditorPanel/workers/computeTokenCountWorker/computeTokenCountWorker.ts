import type { ComputeTokenCountWorkerPayload } from '../../types';

declare global {
  // eslint-disable-next-line no-var
  var importScripts: (str: string) => void;
  // eslint-disable-next-line no-var
  var pyodide: any;
  // eslint-disable-next-line no-var
  var loadPyodide: any;
}

try {
  importScripts('https://cdn.jsdelivr.net/npm/pyodide@0.27.7/pyodide.js');
} catch (_e) {
  console.warn('Failed to import pyodide.js');
}
async function loadPyodideAndPackages() {
  self.pyodide = await loadPyodide();
  await self.pyodide.loadPackage(['tiktoken']);
}

const pyodideReadyPromise = loadPyodideAndPackages();

self.onmessage = async (
  event: MessageEvent<ComputeTokenCountWorkerPayload>,
) => {
  // make sure loading is done
  await pyodideReadyPromise;

  const { model, text } = event.data;

  const python = `import tiktoken

enc = tiktoken.encoding_for_model("${model}")

len(tiktoken.encode("""${text}"""))
`;

  const results = await self.pyodide.runPythonAsync(python);
  self.postMessage(results);
};
