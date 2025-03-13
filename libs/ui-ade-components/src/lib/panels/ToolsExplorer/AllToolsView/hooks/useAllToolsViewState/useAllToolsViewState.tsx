import { createContext, useCallback, useContext, useState } from 'react';
import { useToolsExplorerState } from '../../../useToolsExplorerState/useToolsExplorerState';

export type ToolViewerCategory = 'composio' | 'current' | 'local' | 'mcp';

export interface AllToolsViewState {
  category: ToolViewerCategory;
  setCategory: (category: ToolViewerCategory) => void;
}

const AllToolsViewStateContext = createContext<AllToolsViewState | undefined>(
  undefined,
);

interface AllToolsViewStateProviderProps {
  children: React.ReactNode;
}

export function AllToolsViewStateProvider(
  props: AllToolsViewStateProviderProps,
) {
  const [category, setCategory] = useState<ToolViewerCategory>('current');
  const { children } = props;

  const { clearCurrentTool } = useToolsExplorerState();

  const handleSelectCategory = useCallback(
    (category: ToolViewerCategory) => {
      setCategory(category);
      clearCurrentTool();
    },
    [clearCurrentTool],
  );

  return (
    <AllToolsViewStateContext.Provider
      value={{ category, setCategory: handleSelectCategory }}
    >
      {children}
    </AllToolsViewStateContext.Provider>
  );
}

export function useAllToolsViewState() {
  const context = useContext(AllToolsViewStateContext);

  if (context === undefined) {
    throw new Error(
      'useAllToolsViewState must be used within a AllToolsViewStateProvider',
    );
  }
  return context;
}
