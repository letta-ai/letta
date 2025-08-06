import '@tanstack/react-table';
import type { RowData } from '@tanstack/react-table';
import type en from './translations/en.json';
import type { en as adeEn } from '@letta-cloud/ui-ade-components/translations';
import { en as componentTranslations } from '@letta-cloud/ui-component-library';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.svg' {
  const content: any;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export const ReactComponent: any;
  export default content;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    style: {
      columnAlign?: 'center' | 'left' | 'right';
      sticky?: 'left' | 'right';
      width?: string;
    };
  }
}

export const messages = {
  ...en,
  ...adeEn,
  ...componentTranslations,
};

type Messages = typeof messages;

declare global {
  // Use type safe message keys with `next-intl`
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}

declare global {
  interface Window {
    Appcues: any;
  }
}
declare global {
  interface Window {
    AppcuesSettings: any;
  }
}
