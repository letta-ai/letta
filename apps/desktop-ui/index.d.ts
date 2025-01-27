// extend window with electron
import type { ServerLogType } from '@letta-cloud/types';

declare global {
  interface Window {
    electron: {
      getAppVersion: () => Promise<string>;
      setToDashboardSize: () => void;
      platform: string;
    };
    router: {
      onUpdateRoute: (callback: (path: string) => void) => void;
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
      onLoad: (callback: (config: string) => void) => void;
    };
  }
}
