import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ToolManagerPaths } from '../../toolManagerRoutes';

interface ToolManagerState {
  requireConfirmation: boolean;
  path: ToolManagerPaths | null;
  isConfirmationDialogOpen: boolean;
  currentToolId: string | null;
}

const initialState: ToolManagerState = {
  requireConfirmation: false,
  isConfirmationDialogOpen: false,
  path: null,
  currentToolId: null,
};

interface ToolManagerContextState {
  toolManagerState: ToolManagerState;
  setToolManagerState: Dispatch<SetStateAction<ToolManagerState>>;
}

const ToolManagerContext = createContext<ToolManagerContextState>({
  toolManagerState: initialState,
  setToolManagerState: () => {
    return;
  },
});

export function ToolManagerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toolManagerState, setToolManagerState] = useState(initialState);

  const value = useMemo(
    () => ({
      toolManagerState,
      setToolManagerState,
    }),
    [toolManagerState, setToolManagerState],
  );

  return (
    <ToolManagerContext.Provider value={value}>
      {children}
    </ToolManagerContext.Provider>
  );
}

function useToolManagerContext() {
  return useContext(ToolManagerContext);
}

export function useToolManagerState() {
  const { toolManagerState, setToolManagerState } = useToolManagerContext();

  const closeToolManager = useCallback(
    (confirmed?: boolean) => {
      if (toolManagerState.requireConfirmation && !confirmed) {
        setToolManagerState((prev) => ({
          ...prev,
          isConfirmationDialogOpen: true,
        }));

        return;
      }

      setToolManagerState(initialState);
      return;
    },
    [toolManagerState, setToolManagerState],
  );

  const openToolManager = useCallback(
    (initialPath: ToolManagerPaths, initialToolId?: string) => {
      // check if valid route
      setToolManagerState({
        ...initialState,
        path: initialPath,
        currentToolId: initialToolId || null,
      });
    },
    [setToolManagerState],
  );

  const setDialogOpen = useCallback(
    (isOpen: boolean) => {
      setToolManagerState((prev) => ({
        ...prev,
        isConfirmationDialogOpen: isOpen,
      }));
    },
    [setToolManagerState],
  );

  const setPath = useCallback(
    (path: string) => {
      setToolManagerState((prev) => ({ ...prev, path }));
    },
    [setToolManagerState],
  );

  const setSelectedToolId = useCallback(
    (toolId: string | null) => {
      setToolManagerState((prev) => ({ ...prev, currentToolId: toolId }));
    },
    [setToolManagerState],
  );

  return useMemo(
    () => ({
      setPath,
      setSelectedToolId,
      currentToolId: toolManagerState.currentToolId,
      currentPath: toolManagerState.path,
      isConfirmationDialogOpen: toolManagerState.isConfirmationDialogOpen,
      setDialogOpen,
      isToolManagerOpen: !!toolManagerState.path,
      closeToolManager,
      openToolManager,
    }),
    [
      setSelectedToolId,
      toolManagerState.currentToolId,
      toolManagerState.path,
      toolManagerState.isConfirmationDialogOpen,
      closeToolManager,
      openToolManager,
      setDialogOpen,
      setPath,
    ],
  );
}
