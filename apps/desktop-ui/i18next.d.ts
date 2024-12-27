// import the original type declarations
import 'i18next';
// import all namespaces (for the default language, only)
import type en from 'locales/en.json';

declare module 'i18next' {
  // Extend CustomTypeOptions
  interface CustomTypeOptions {
    resources: typeof en;
  }
}
