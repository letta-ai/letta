import { createGlobPatternsForDependencies } from '@nx/react/tailwind';
import { join } from 'node:path';
import TailwindAnimate from 'tailwindcss-animate';

import type { Config } from 'tailwindcss';

export function buildConfig(appDir: string): Config {
  return {
    content: [
      join(
        appDir,
        '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
      ),
      ...createGlobPatternsForDependencies(appDir),
    ],
    theme: {
      extend: {
        gap: {
          2: 'var(--default-gap)',
        },
        transitionProperty: {
          width: 'width',
        },
        height: {
          biHeight: 'var(--button-input-height)',
          'biHeight-sm': 'var(--button-input-height-sm)',
          'biHeight-lg': 'var(--button-input-height-lg)',
          panel: 'var(--panel-row-height)',
        },
        width: {
          biWidth: 'var(--button-input-height)',
          'biWidth-sm': 'var(--button-input-height-sm)',
        },
        fontSize: {
          sm: 'var(--font-size-sm)',
          base: 'var(--font-size-base)',
          lg: 'var(--font-size-lg)',
          xl: 'var(--font-size-xl)',
        },
        colors: {
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          background: {
            hover: 'hsl(var(--background-hover))',
            DEFAULT: 'hsl(var(--background))',
          },
          'background-grey': {
            DEFAULT: 'hsl(var(--background-grey))',
            content: 'hsl(var(--background-grey-content))',
          },
          'background-greyer': {
            DEFAULT: 'hsl(var(--background-greyer))',
            content: 'hsl(var(--background-greyer-content))',
          },
          'background-black': {
            DEFAULT: 'hsl(var(--background-black))',
            content: 'hsl(var(--background-black-content))',
          },
          content: 'hsl(var(--content))',
          ['on-transparent']: 'hsl(var(--on-transparent))',
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            content: 'hsl(var(--primary-content))',
            hover: 'hsl(var(--primary-hover))',
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            hover: 'hsl(var(--secondary-hover))',
            content: 'hsl(var(--secondary-content))',
          },
          tertiary: {
            DEFAULT: 'hsl(var(--tertiary))',
            content: 'hsl(var(--tertiary-content))',
            active: 'hsl(var(--tertiary-active))',
            hover: 'hsl(var(--tertiary-hover))',
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            content: 'hsl(var(--destructive-content))',
          },
          positive: {
            DEFAULT: 'hsl(var(--positive))',
            content: 'hsl(var(--positive-content))',
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            content: 'hsl(var(--muted-content))',
          },
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            content: 'hsl(var(--accent-content))',
          },
          warning: {
            DEFAULT: 'hsl(var(--warning))',
            content: 'hsl(var(--warning-content))',
          },
          'background-warning': {
            DEFAULT: 'hsl(var(--background-warning))',
            content: 'hsl(var(--background-warning-content))',
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            content: 'hsl(var(--popover-content))',
          },
          card: {
            DEFAULT: 'hsl(var(--card))',
            content: 'hsl(var(--card-content))',
          },
        },
        borderRadius: {
          DEFAULT: `var(--radius)`,
          sm: '3px',
        },
        keyframes: {
          'accordion-down': {
            from: { height: '0' },
            to: { height: 'var(--radix-accordion-content-height)' },
          },
          'accordion-up': {
            from: { height: 'var(--radix-accordion-content-height)' },
            to: { height: '0' },
          },
        },
        animation: {
          'accordion-down': 'accordion-down 0.2s ease-out',
          'accordion-up': 'accordion-up 0.2s ease-out',
        },
      },
    },
    darkMode: ['class', '[data-mode="dark"]'],
    plugins: [TailwindAnimate],
  };
}
