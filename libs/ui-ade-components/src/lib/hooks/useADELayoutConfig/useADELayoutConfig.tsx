'use client';
import { useQueryClient } from '@tanstack/react-query';
import {
  getADEConfigConstants,
  type GetADELayoutConfigOptions,
  GetADELayoutConfigOptionsSchema,
} from '@letta-cloud/utils-shared';
import { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';

const { generateCookieString, ADELayoutQueryKey } = getADEConfigConstants();

const leftPanelToggleId = `left-panel-toggle`;
const rightPanelToggleId = `right-panel-toggle`;

const isRightSidebarOpenAtom = atom<boolean>(true);
const isLeftSidebarOpenAtom = atom<boolean>(true);

export function useADELayoutConfig() {
  const queryClient = useQueryClient();

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useAtom(
    isRightSidebarOpenAtom,
  );
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useAtom(
    isLeftSidebarOpenAtom,
  );

  const layoutConfig = useMemo(() => {
    const data =
      queryClient.getQueryData<GetADELayoutConfigOptions>(ADELayoutQueryKey);

    return GetADELayoutConfigOptionsSchema.safeParse(data).success
      ? data
      : undefined;
  }, [queryClient]);

  useEffect(() => {
    if (layoutConfig) {
      setIsLeftSidebarOpen(layoutConfig.panelLayout[0] !== 0);
      setIsRightSidebarOpen(layoutConfig.panelLayout[2] !== 0);
    }
  }, [layoutConfig, setIsLeftSidebarOpen, setIsRightSidebarOpen]);

  const setLayoutConfig = useCallback(
    function setConfig(options: Partial<GetADELayoutConfigOptions>): void {
      queryClient.setQueryData<GetADELayoutConfigOptions>(
        ADELayoutQueryKey,
        (prev) => {
          const nextState = {
            panelLayout: options.panelLayout ?? prev?.panelLayout ?? [],
          };

          return nextState;
        },
      );

      document.cookie = generateCookieString({
        panelLayout: options.panelLayout ?? layoutConfig?.panelLayout ?? [],
      });
    },
    [layoutConfig?.panelLayout, queryClient],
  );

  const toggleLeftPanel = useCallback(() => {
    const leftPanel = document.getElementById(leftPanelToggleId);

    if (!leftPanel) {
      return;
    }

    setIsLeftSidebarOpen((v) => !v);
    leftPanel.click();
  }, [setIsLeftSidebarOpen]);

  const toggleRightPanel = useCallback(() => {
    const rightPanel = document.getElementById(rightPanelToggleId);

    if (!rightPanel) {
      return;
    }

    setIsRightSidebarOpen((v) => !v);

    rightPanel.click();
  }, [setIsRightSidebarOpen]);

  return {
    layoutConfig,
    setLayoutConfig,
    toggleRightPanel,
    toggleLeftPanel,
    isRightSidebarOpen,
    isLeftSidebarOpen,
    leftPanelToggleId,
    rightPanelToggleId,
  };
}
