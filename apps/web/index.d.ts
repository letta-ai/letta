import '@tanstack/react-table';
import type { RowData } from '@tanstack/react-table';
import type en from './translations/en.json';
import type { en as adeEn } from '@letta-cloud/shared-ade-components/translations';

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
      columnAlign: 'center' | 'left' | 'right';
      sticky?: 'left' | 'right';
    };
  }
}

export const messages = {
  ...en,
  ...adeEn,
};

type Messages = typeof messages;

declare global {
  // Use type safe message keys with `next-intl`
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
