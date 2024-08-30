import * as React from 'react';
import 'tailwindcss/tailwind.css';
import '../../core-style-config/src/global.css';
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
} from '@storybook/blocks';

export const parameters: Preview = {
  tags: ['autodocs'],
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
        <Story />
      </div>
    ),
  ],
  parameters: {
    page: () => (
      <>
        <Title />
        <Subtitle />
        <Description />
        <Primary />
        <Controls />
        <Stories />
      </>
    ),
  },
};

export default parameters;
