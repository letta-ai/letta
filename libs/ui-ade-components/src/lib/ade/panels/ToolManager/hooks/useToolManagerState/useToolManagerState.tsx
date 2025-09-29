'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ToolManagerPaths } from '../../toolManagerRoutes';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { atom, useAtom } from 'jotai';
import { dirtyToolAtom } from '../useStagedCode/useStagedCode';

export const currentToolIdAtom = atom<string | null>(null);

interface ToolManagerState {
  requireConfirmation: boolean;
  path: ToolManagerPaths | null;
  isConfirmationDialogOpen: boolean;
  currentToolId: string | null;
  selectedServerKey: string | null;
}

const initialState: ToolManagerState = {
  requireConfirmation: false,
  isConfirmationDialogOpen: false,
  path: null,
  currentToolId: null,
  selectedServerKey: null,
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

  const router = useRouter();
  const pathname = usePathname();
  const { developmentServerId } = useParams<{ developmentServerId?: string }>();

  const [dirtyToolMap] = useAtom(dirtyToolAtom);
  const [currentToolId, setCurrentToolId] = useAtom(currentToolIdAtom);

  const hasDirtyTools = useMemo(() => {
    return Object.values(dirtyToolMap).some((isDirty) => isDirty);
  }, [dirtyToolMap]);

  const isInStandaloneToolManager = useMemo(() => {
    return !(pathname.includes('agents') || pathname.includes('templates'));
  }, [pathname]);

  const isInSelfHostedServers = useMemo(() => {
    return pathname.includes('development-servers');
  }, [pathname]);

  const closeToolManager = useCallback(
    (confirmed?: boolean) => {
      if (
        (toolManagerState.requireConfirmation || hasDirtyTools) &&
        !confirmed
      ) {
        setToolManagerState((prev) => ({
          ...prev,
          isConfirmationDialogOpen: true,
        }));

        return;
      }

      setToolManagerState(initialState);
      return;
    },
    [toolManagerState, hasDirtyTools, setToolManagerState],
  );

  const openToolManager = useCallback(
    (initialPath: ToolManagerPaths, initialToolId?: string) => {
      // check if valid route
      setToolManagerState({
        ...initialState,
        path: initialPath,
        currentToolId: initialToolId || null,
      });
      setCurrentToolId(initialToolId || null);
    },
    [setToolManagerState, setCurrentToolId],
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
      if (isInStandaloneToolManager) {
        let basePath = '';
        if (isInSelfHostedServers) {
          basePath = `/development-servers/${developmentServerId}`;
        }

        if (path.includes('mcp')) {
          // mcp has its own route
          router.push(`${basePath}${path}`);
          return;
        }

        if (CURRENT_RUNTIME === 'letta-docker-enterprise') {
          window.location.reload();
          return;
        }

        router.push(`${basePath}/tools${path}`);
        return;
      }

      setToolManagerState((prev) => ({ ...prev, path }));
    },
    [
      isInStandaloneToolManager,
      isInSelfHostedServers,
      developmentServerId,
      router,
      setToolManagerState,
    ],
  );

  const setSelectedToolId = useCallback(
    (toolId: string | null) => {
      setCurrentToolId(toolId);
    },
    [setCurrentToolId],
  );

  const setSelectedServerKey = useCallback(
    (serverKey: string | null) => {
      setToolManagerState((prev) => ({
        ...prev,
        selectedServerKey: serverKey,
      }));
    },
    [setToolManagerState],
  );

  return useMemo(
    () => ({
      setPath,
      setSelectedToolId,
      setSelectedServerKey,
      currentToolId,
      selectedServerKey: toolManagerState.selectedServerKey,
      currentPath: toolManagerState.path,
      isConfirmationDialogOpen: toolManagerState.isConfirmationDialogOpen,
      setDialogOpen,
      isToolManagerOpen: !!toolManagerState.path,
      closeToolManager,
      openToolManager,
    }),
    [
      setSelectedToolId,
      setSelectedServerKey,
      currentToolId,
      toolManagerState.selectedServerKey,
      toolManagerState.path,
      toolManagerState.isConfirmationDialogOpen,
      closeToolManager,
      openToolManager,
      setDialogOpen,
      setPath,
    ],
  );
}
