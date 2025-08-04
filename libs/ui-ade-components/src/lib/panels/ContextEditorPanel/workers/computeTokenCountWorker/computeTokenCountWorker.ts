import type { ComputeTokenCountWorkerPayload } from '../../types';

declare global {
  var importScripts: (str: string) => void;

  var pyodide: any;

  var loadPyodide: any;
}

try {
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
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
