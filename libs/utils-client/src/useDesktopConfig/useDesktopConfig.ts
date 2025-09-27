import { useCallback, useEffect, useState } from 'react';
import type { DesktopConfigSchemaType } from '@letta-cloud/types';
import { useAtom, atom } from 'jotai';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

export const desktopConfigAtom = atom<DesktopConfigSchemaType | null>(null);

export function useDesktopConfig() {
  const [isLoading, setIsLoading] = useState(true);
  const [desktopConfig, setDesktopConfig] = useAtom(desktopConfigAtom);

  useEffect(() => {
    if (CURRENT_RUNTIME !== 'letta-desktop') {
      return;
    }

    // @ts-ignore
    void window.desktopConfig.get();

    // @ts-ignore
    window.desktopConfig.onGetConfig((config: DesktopConfigSchemaType) => {
      setDesktopConfig(config);
      setIsLoading(false);
    });

  }, [setDesktopConfig]);

  const handleSetDesktopConfig = useCallback(
    async (config: DesktopConfigSchemaType) => {
      if (CURRENT_RUNTIME !== 'letta-desktop') {
        return;
      }
      setDesktopConfig(config);

      // @ts-ignore
      await window.desktopConfig.save(config);
    },
    [setDesktopConfig],
  );

  return {
    desktopConfig,
    handleSetDesktopConfig,
    isLoading,
  };
}
