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
      screens: {
        sm: '640px',
        largerThanMobile: '640px',
        visibleSidebar: '840px',
      },
      extend: {
        zIndex: {
          rightAboveZero: '1',
          sidebarNavOverlay: '6',
          sidebarNav: '7',
          header: '8',
          miniapp: '9',
          dialog: '10',
          dropdown: '11',
          tooltip: '12',
          draggedItem: '13',
        },
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
          header: 'var(--header-height)',
          'header-sm': 'var(--header-height-sm)',
        },
        minHeight: {
          header: 'var(--header-height)',
          'header-sm': 'var(--header-height-sm)',
          biHeight: 'var(--button-input-height)',
          'biHeight-sm': 'var(--button-input-height-sm)',
          'biHeight-lg': 'var(--button-input-height-lg)',
        },
        width: {
          biWidth: 'var(--button-input-height)',
          'biWidth-sm': 'var(--button-input-height-sm)',
          sidebar: 'var(--sidebar-width)',
        },
        maxWidth: {
          sidebar: 'var(--sidebar-width)',
        },
        minWidth: {
          sidebar: 'var(--sidebar-width)',
        },
        fontSize: {
          xxs: 'var(--font-size-xxs)',
          xs: 'var(--font-size-xs)',
          sm: 'var(--font-size-sm)',
          base: 'var(--font-size-base)',
          lg: 'var(--font-size-lg)',
          xl: 'var(--font-size-xl)',
        },
        colors: {
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          steel: 'hsl(var(--steel))',
          text: {
            DEFAULT: 'hsl(var(--text-primary))',
            secondary: 'hsl(var(--text-secondary))',
          },
          'background-violet': {
            DEFAULT: 'hsl(var(--background-violet))',
            content: 'hsl(var(--background-violet-content))',
          },
          'background-success': {
            DEFAULT: 'hsl(var(--background-success))',
            content: 'hsl(var(--background-success-content))',
          },
          background: {
            hover: 'hsl(var(--background-hover))',
            DEFAULT: 'hsl(var(--background))',
          },
          'primary-light': {
            DEFAULT: 'hsl(var(--primary-light))',
            content: 'hsl(var(--primary-light-content))',
          },
          'background-grey': {
            DEFAULT: 'hsl(var(--background-grey))',
            content: 'hsl(var(--background-grey-content))',
            hover: 'hsl(var(--background-grey-hover))',
          },
          'background-grey2': {
            DEFAULT: 'hsl(var(--background-grey2))',
            content: 'hsl(var(--background-grey2-content))',
          },
          'background-black': {
            DEFAULT: 'hsl(var(--background-black))',
            content: 'hsl(var(--background-black-content))',
            hover: 'hsl(var(--background-black-hover))',
          },
          'background-destructive': {
            DEFAULT: 'hsl(var(--background-destructive))',
            content: 'hsl(var(--background-destructive-content))',
          },
          content: 'hsl(var(--content))',
          ['on-transparent']: 'hsl(var(--on-transparent))',
          'primary-alt': {
            DEFAULT: 'hsl(var(--primary-alt))',
            content: 'hsl(var(--primary-alt-content))',
            hover: 'hsl(var(--primary-alt-hover))',
          },
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
          progress: {
            '0%': { transform: 'translateX(0) scaleX(0)' },
            '40%': { transform: 'translateX(0) scaleX(0.4)' },
            '100%': { transform: 'translateX(100%) scaleX(0.5)' },
          },
        },
        animation: {
          'accordion-down': 'accordion-down 0.2s ease-out',
          'accordion-up': 'accordion-up 0.2s ease-out',
          progress: 'progress 1s infinite linear',
        },
      },
    },
    darkMode: ['class', '[data-mode="dark"]'],
    plugins: [TailwindAnimate],
  };
}
