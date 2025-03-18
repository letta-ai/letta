import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useAtom } from 'jotai';
import { selectedCurrentAgentToolId } from '../../routes/CurrentAgentTools/CurrentAgentTools';

interface ToolManagerState {
  requireConfirmation: boolean;
  path: string | null;
  isConfirmationDialogOpen: boolean;
}

const initialState: ToolManagerState = {
  requireConfirmation: false,
  isConfirmationDialogOpen: false,
  path: null,
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
  const [_, setCurrentSelectedToolId] = useAtom(selectedCurrentAgentToolId);

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
    (initialPath: string, initialToolId?: string) => {
      // check if valid route
      setToolManagerState({
        ...initialState,
        path: initialPath,
      });

      if (initialToolId) {
        setCurrentSelectedToolId(initialToolId);
      }
    },
    [setToolManagerState, setCurrentSelectedToolId],
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

  return useMemo(
    () => ({
      setPath,
      currentPath: toolManagerState.path,
      isConfirmationDialogOpen: toolManagerState.isConfirmationDialogOpen,
      setDialogOpen,
      isToolManagerOpen: !!toolManagerState.path,
      closeToolManager,
      openToolManager,
    }),
    [
      toolManagerState.path,
      toolManagerState.isConfirmationDialogOpen,
      closeToolManager,
      openToolManager,
      setDialogOpen,
      setPath,
    ],
  );
}
