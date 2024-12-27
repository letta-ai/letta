import '@tanstack/react-table';
import type { RowData } from '@tanstack/react-table';
import type en from './translations/en.json';

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

type Messages = typeof en;

declare global {
  // Use type safe message keys with `next-intl`
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
