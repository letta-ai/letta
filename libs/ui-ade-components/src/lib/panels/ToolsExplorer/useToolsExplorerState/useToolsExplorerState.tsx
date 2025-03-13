import { atom, useAtom } from 'jotai/index';
import { useCallback, useMemo } from 'react';
import type { ToolMetadataPreviewType } from '@letta-cloud/sdk-web';
export type ToolViewerState = 'edit' | 'view';

const toolsExplorerAtom = atom<ToolsExplorerContextState>({
  currentTool: undefined,
  isOpen: false,
});

export interface ToolExplorerCurrentToolState
  extends Partial<ToolMetadataPreviewType> {
  id: string;
  provider: string;
}

interface ViewOrEditState {
  data: ToolExplorerCurrentToolState;
  mode: ToolViewerState;
}

export function isCurrentToolInViewOrEdit(
  state: ToolsExplorerContextState['currentTool'],
): state is ViewOrEditState {
  return !!(state && Object.prototype.hasOwnProperty.call(state, 'data'));
}

export interface ToolsExplorerContextState {
  currentTool?: ViewOrEditState | { mode: 'create' };
  isOpen: boolean;
}

export function useToolsExplorerState() {
  const [explorerState, setExplorerState] = useAtom(toolsExplorerAtom);

  const isToolExplorerOpen = useMemo(() => {
    return explorerState.isOpen;
  }, [explorerState]);

  const openToolExplorer = useCallback(
    (state?: Partial<ToolsExplorerContextState>) => {
      setExplorerState({
        currentTool: state?.currentTool,
        isOpen: true,
      });
    },
    [setExplorerState],
  );

  const startCreateTool = useCallback(() => {
    setExplorerState({
      currentTool: { mode: 'create' },
      isOpen: true,
    });
  }, [setExplorerState]);

  const closeToolExplorer = useCallback(() => {
    setExplorerState({
      currentTool: undefined,
      isOpen: false,
    });
  }, [setExplorerState]);

  const switchToolState = useCallback(
    (mode: ToolViewerState) => {
      setExplorerState((prev) => {
        if (!prev.currentTool) {
          return prev;
        }

        if (!isCurrentToolInViewOrEdit(prev.currentTool)) {
          return prev;
        }

        return {
          ...prev,
          currentTool: {
            data: prev.currentTool.data,
            mode,
          },
        };
      });
    },
    [setExplorerState],
  );

  const setCurrentTool = useCallback(
    (tool: ToolMetadataPreviewType, mode: ToolViewerState = 'view') => {
      setExplorerState((prev) => {
        return {
          ...prev,
          currentTool: {
            data: tool,
            mode,
          },
        };
      });
    },
    [setExplorerState],
  );

  const clearCurrentTool = useCallback(() => {
    setExplorerState((prev) => {
      return {
        ...prev,
        currentTool: undefined,
      };
    });
  }, [setExplorerState]);

  return {
    currentTool: explorerState.currentTool,
    setCurrentTool,
    clearCurrentTool,
    isToolExplorerOpen,
    switchToolState,
    openToolExplorer,
    startCreateTool,
    closeToolExplorer,
  };
}
