'use client';
import { atom, useAtom } from 'jotai';
import { useToolsServiceRetrieveTool } from '@letta-cloud/sdk-core';
import type { Tool } from '@letta-cloud/sdk-core';
import { useCallback, useEffect, useMemo } from 'react';
import { isEqual } from 'lodash';

export const stagedToolAtom = atom<Record<string, Tool>>({});
export const dirtyToolAtom = atom<Record<string, boolean>>({});

export function useStagedCode(defaultTool: Tool) {
  const toolId = defaultTool.id || '';
  const [stagedToolMap, setStagedToolMap] = useAtom(stagedToolAtom);
  const [_, setDirtyToolMap] = useAtom(dirtyToolAtom);

  const { data: state } = useToolsServiceRetrieveTool(
    {
      toolId,
    },
    undefined,
    {
      placeholderData: defaultTool,
    },
  );
  const stagedTool = useMemo(() => {
    return stagedToolMap[toolId] || defaultTool;
  }, [stagedToolMap, toolId, defaultTool]);

  const setStagedTool = useCallback(
    (toolFn: (tool: Tool) => Tool) => {
      setStagedToolMap((prev) => {
        const res = toolFn(prev[toolId] || defaultTool);

        return {
          ...prev,
          [toolId]: res,
        };
      });
    },
    [setStagedToolMap, toolId, defaultTool],
  );

  const resetStagedTool = useCallback(() => {
    document.dispatchEvent(new Event('resetStagedTool'));

    setStagedToolMap((prev) => {
      return {
        ...prev,
        [toolId]: defaultTool,
      };
    });
  }, [setStagedToolMap, toolId, defaultTool]);

  const isDirty = useMemo(() => {
    return (
      stagedTool && state?.tool_type === 'custom' && !isEqual(stagedTool, state)
    );
  }, [stagedTool, state]);

  useEffect(() => {
    setDirtyToolMap((prev) => {
      return {
        ...prev,
        [toolId]: isDirty,
      };
    });
  }, [isDirty, setDirtyToolMap, toolId]);

  return {
    isDirty,
    stagedTool,
    setStagedTool,
    resetStagedTool,
  };
}
