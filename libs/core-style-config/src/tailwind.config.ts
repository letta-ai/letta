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
        transitionProperty: {
          width: 'width',
        },
        fontSize: {
          base: 'var(--font-size-base)',
        },
        colors: {
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          background: {
            light: 'hsl(var(--background-light))',
            DEFAULT: 'hsl(var(--background))',
          },
          'background-grey': {
            DEFAULT: 'hsl(var(--background-grey))',
            foreground: 'hsl(var(--background-grey-foreground))',
          },
          'background-greyer': {
            DEFAULT: 'hsl(var(--background-greyer))',
            foreground: 'hsl(var(--background-greyer-foreground))',
          },
          'background-black': {
            DEFAULT: 'hsl(var(--background-black))',
            foreground: 'hsl(var(--background-black-foreground))',
          },
          foreground: 'hsl(var(--foreground))',
          ['on-transparent']: 'hsl(var(--on-transparent))',
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))',
            light: 'hsl(var(--primary-light))',
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            light: 'hsl(var(--secondary-light))',
            foreground: 'hsl(var(--secondary-foreground))',
          },
          tertiary: {
            DEFAULT: 'hsl(var(--tertiary))',
            foreground: 'hsl(var(--tertiary-foreground))',
            dark: 'hsl(var(--tertiary-dark))',
            light: 'hsl(var(--tertiary-light))',
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))',
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))',
          },
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))',
          },
          warning: {
            DEFAULT: 'hsl(var(--warning))',
            foreground: 'hsl(var(--warning-foreground))',
          },
          'background-warning': {
            DEFAULT: 'hsl(var(--background-warning))',
            foreground: 'hsl(var(--background-warning-foreground))',
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))',
          },
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))',
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
