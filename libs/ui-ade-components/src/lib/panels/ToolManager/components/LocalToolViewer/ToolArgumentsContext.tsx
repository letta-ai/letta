import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ResizableKeyValueEditorDefinition } from '@letta-cloud/ui-component-library';

interface ToolArgumentsContextState {
  sampleArguments: ResizableKeyValueEditorDefinition[];
  updateSampleArguments: (args: unknown) => void;
}

const ToolArgumentsContext = createContext<ToolArgumentsContextState | null>(
  null,
);

interface ToolArgumentsProviderProps {
  children: ReactNode;
}

export function ToolArgumentsProvider({
  children,
}: ToolArgumentsProviderProps) {
  const [sampleArguments, setSampleArguments] = useState<
    ResizableKeyValueEditorDefinition[]
  >([]);

  function formatArguments(args: unknown): ResizableKeyValueEditorDefinition[] {
    if (!args) return [];

    const entries = Array.isArray(args) ? args : Object.entries(args);
    return Array.isArray(entries)
      ? entries.map((entry) => {
          const [key, value] = Array.isArray(entry)
            ? entry
            : [entry.key, entry.value];
          return {
            key,
            value:
              typeof value === 'object' ? JSON.stringify(value) : String(value),
            type: typeof value,
          };
        })
      : [];
  }

  function updateSampleArguments(args: unknown) {
    if (args) {
      const formattedArgs = formatArguments(args);
      setSampleArguments(formattedArgs);
    }
  }

  return (
    <ToolArgumentsContext.Provider
      value={{
        sampleArguments,
        updateSampleArguments,
      }}
    >
      {children}
    </ToolArgumentsContext.Provider>
  );
}

export function useToolArguments() {
  const context = useContext(ToolArgumentsContext);

  if (!context) {
    throw new Error(
      'useToolArguments must be used within a ToolArgumentsProvider',
    );
  }

  return context;
}
