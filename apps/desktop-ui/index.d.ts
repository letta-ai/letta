// extend window with electron
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
    lettaCore: {
      start: () => Promise<void>;
      stop: () => Promise<void>;
    };
  }
}
