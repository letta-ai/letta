// extend window with electron
import type { ServerLogType } from '@letta-cloud/types';

declare global {
  interface Window {
    electron: {
      getAppVersion: () => Promise<string>;
      platform: string;
    };
    darkMode: {
      toggle: () => Promise<void>;
      system: () => Promise<void>;
    };
    lettaServer: {
      restart: () => Promise<void>;
      getLogs: () => Promise<string>;
      onGetLogs: (callback: (logs: ServerLogType[]) => void) => void;
    };
    lettaConfig: {
      load: () => Promise<void>;
      save: (config: any) => Promise<void>;
      onLoad: (callback: (config: any) => void) => void;
    };
  }
}
