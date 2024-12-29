import * as React from 'react';
import 'tailwindcss/tailwind.css';
import '../../core-style-config/src/global.scss';
import './storybook.css';

import { Preview, ReactRenderer } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';
import {
  Title,
  Subtitle,
  Description,
  Primary,
  Controls,
  Stories,
  Source,
} from '@storybook/blocks';
import { NextIntlClientProvider } from 'next-intl';

export const parameters: Preview = {
  decorators: [
    withThemeByClassName<ReactRenderer>({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    (Story) => (
      <div className="sb-make-dark">
        <NextIntlClientProvider locale="en" messages={{}}>
          <Story />
        </NextIntlClientProvider>
      </div>
    ),
  ],
  tags: ['autodocs'],
  parameters: {
    options: {
      storySort: {
        method: '',
        order: ['Concepts'],
        locales: '',
      },
    },
    docs: {
      page: () => (
        <>
          <Title />
          <Subtitle />
          <Description />
          <Primary />
          <Source />
          <Controls />
          <Stories />
        </>
      ),
    },
  },
};

export default parameters;
