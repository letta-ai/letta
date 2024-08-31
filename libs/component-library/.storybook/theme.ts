import { create } from '@storybook/theming/create';

export const storybookTheme = create({
  base: 'light',
  fontBase: 'Overused Grotesk, sans-serif',
  brandTitle: 'LettaBook',
  brandTarget: '_self',
  barBg: '#F1F5F9',
  appBg: '#fff',
  brandImage: './letta-logo.svg',
});
