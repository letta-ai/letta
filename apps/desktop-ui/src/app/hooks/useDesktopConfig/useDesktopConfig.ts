import { useCallback, useEffect, useState } from 'react';
import type { DesktopConfigSchemaType } from '@letta-cloud/types';
import { useAtom, atom } from 'jotai';

export const desktopConfigAtom = atom<DesktopConfigSchemaType | null>(null);

export function useDesktopConfig() {
  const [isLoading, setIsLoading] = useState(true);
  const [desktopConfig, setDesktopConfig] = useAtom(desktopConfigAtom);

  useEffect(() => {
    void window.desktopConfig.get();

    window.desktopConfig.onGetConfig((config: DesktopConfigSchemaType) => {
      setDesktopConfig(config);
      setIsLoading(false);
    });
  }, [setDesktopConfig]);

  const handleSetDesktopConfig = useCallback(
    async (config: DesktopConfigSchemaType) => {
      setDesktopConfig(config);
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
