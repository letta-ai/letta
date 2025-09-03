'use client';
import { atom, useAtom } from 'jotai';
import { useToolsServiceRetrieveTool } from '@letta-cloud/sdk-core';
import type { Tool } from '@letta-cloud/sdk-core';
import { useCallback, useMemo } from 'react';
import { isEqual } from 'lodash';

const stagedToolAtom = atom<Record<string, Tool>>({});

export function useStagedCode(defaultTool: Tool) {
  const toolId = defaultTool.id || '';
  const [stagedToolMap, setStagedToolMap] = useAtom(stagedToolAtom);

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
    return !isEqual(stagedTool, state);
  }, [stagedTool, state]);

  return {
    isDirty,
    stagedTool,
    setStagedTool,
    resetStagedTool,
  };
}
