import { join } from 'node:path';
import TailwindAnimate from 'tailwindcss-animate';

import type { Config } from 'tailwindcss';

export function buildConfig(appDir: string): Config {
  return {
    content: [
      join(appDir, '{src,pages,components,app}/**/*!(*.stories|*.spec).tsx'),
      join(appDir, '..', '..', 'libs', '**/*!(*.stories|*.spec).tsx'),
    ],
    theme: {
      screens: {
        sm: '640px',
        largerThanMobile: '640px',
        visibleSidebar: '840px',
        widescreen: '1440px',
      },
      extend: {
        zIndex: {
          rightAboveZero: '1',
          agentSimulatorHeader: '2',
          sidebarNavOverlay: '5',
          sidebarNav: '6',
          header: '7',
          miniappShadow: '8',
          miniapp: '9',
          dialog: '10',
          networkInspector: '11',
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
          'biHeight-xs': 'var(--button-input-height-xs)',
          'biHeight-xsm': 'var(--button-input-height-xsm)',

          'biHeight-sm': 'var(--button-input-height-sm)',
          'biHeight-lg': 'var(--button-input-height-lg)',
          inputHeight: 'var(--input-height)',
          panel: 'var(--panel-row-height)',
          header: 'var(--header-height)',
          'header-sm': 'var(--header-height-sm)',
        },
        minHeight: {
          header: 'var(--header-height)',
          'header-sm': 'var(--header-height-sm)',
          'biHeight-xsm': 'var(--button-input-height-xsm)',
          biHeight: 'var(--button-input-height)',
          'biHeight-xs': 'var(--button-input-height-xs)',
          'biHeight-sm': 'var(--button-input-height-sm)',
          'biHeight-lg': 'var(--button-input-height-lg)',
        },
        width: {
          biWidth: 'var(--button-input-height)',
          'biWidth-xs': 'var(--button-input-height-xs)',
          'biWidth-sm': 'var(--button-input-height-sm)',
          sidebar: 'var(--sidebar-width)',
        },
        maxWidth: {
          sidebar: 'var(--sidebar-width)',
        },
        minWidth: {
          sidebar: 'var(--sidebar-width)',
          biWidth: 'var(--button-input-height)',
          'biWidth-xs': 'var(--button-input-height-xs)',
          'biWidth-sm': 'var(--button-input-height-sm)',
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
          'border-violet': 'hsl(var(--border-violet))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          steel: 'hsl(var(--steel))',
          violet: 'hsl(var(--violet))',
          text: {
            DEFAULT: 'hsl(var(--text-default))',
            lighter: 'hsl(var(--text-lighter))',
          },
          'background-violet': {
            DEFAULT: 'hsl(var(--background-violet))',
            content: 'hsl(var(--background-violet-content))',
          },
          'background-success': {
            DEFAULT: 'hsl(var(--background-success))',
            content: 'hsl(var(--background-success-content))',
            border: 'hsl(var(--background-success-border))',
          },
          background: {
            hover: 'hsl(var(--background-hover))',
            DEFAULT: 'hsl(var(--background))',
          },
          'card-background': 'hsl(var(--card-background))',
          'list-item-background': 'hsl(var(--list-item-background))',
          'panel-input-background': {
            DEFAULT: 'hsl(var(--panel-input-background))',
            content: 'hsl(var(--panel-input-background-content))',
          },
          'button-border': 'hsl(var(--button-border))',
          'project-card-background': 'hsl(var(--project-card-background))',
          'brand-light': {
            DEFAULT: 'hsl(var(--brand-light))',
            content: 'hsl(var(--brand-light-content))',
            hover: 'hsl(var(--brand-light-hover))',
            border: 'hsl(var(--brand-light-border))',
          },
          'background-grey': {
            DEFAULT: 'hsl(var(--background-grey))',
            content: 'hsl(var(--background-grey-content))',
            hover: 'hsl(var(--background-grey-hover))',
          },
          'background-grey2': {
            DEFAULT: 'hsl(var(--background-grey2))',
            content: 'hsl(var(--background-grey2-content))',
            border: 'hsl(var(--background-grey2-border))',
          },
          'background-grey3': {
            DEFAULT: 'hsl(var(--grey3))',
            content: 'hsl(var(--grey3-content))',
            border: 'hsl(var(--background-grey3-border))',
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
          'dark-active': {
            DEFAULT: 'hsl(var(--grey3))',
            content: 'hsl(var(--grey3))',
          },
          content: 'hsl(var(--content))',
          ['on-transparent']: 'hsl(var(--on-transparent))',
          'primary-alt': {
            DEFAULT: 'hsl(var(--brand-alt))',
            content: 'hsl(var(--brand-alt-content))',
            hover: 'hsl(var(--brand-alt-hover))',
          },
          brand: {
            DEFAULT: 'hsl(var(--brand))',
            content: 'hsl(var(--brand-content))',
            hover: 'hsl(var(--brand-hover))',
          },
          'brand-hover': {
            DEFAULT: 'hsl(var(--brand-hover))',
            content: 'hsl(var(--brand-hover-content))',
          },
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            hover: 'hsl(var(--primary-hover))',
            content: 'hsl(var(--primary-content))',
          },
          'destructive-diff': {
            DEFAULT: 'hsl(var(--destructive-diff))',
            content: 'hsl(var(--destructive-diff-content))',
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            content: 'hsl(var(--secondary-content))',
            active: 'hsl(var(--secondary-active))',
            hover: 'hsl(var(--secondary-hover))',
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
            border: 'hsl(var(--background-warning-border))',
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            content: 'hsl(var(--popover-content))',
          },
          card: {
            DEFAULT: 'hsl(var(--card))',
            content: 'hsl(var(--card-content))',
          },
          agent: {
            DEFAULT: 'hsl(var(--agent-color))',
            content: 'hsl(var(--agent-color-content))',
          },
          'chip-standard': {
            DEFAULT: 'rgba(var(--chip-standard))',
            border: 'rgba(var(--chip-standard-border))',
            content: 'rgba(var(--chip-standard-content))',
          },
          'chip-premium': {
            DEFAULT: 'rgba(var(--chip-premium))',
            border: 'rgba(var(--chip-premium-border))',
            content: 'rgba(var(--chip-premium-content))',
          },
          'chip-usage-based': {
            DEFAULT: 'rgba(var(--chip-usage-based))',
            border: 'rgba(var(--chip-usage-based-border))',
            content: 'rgba(var(--chip-usage-based-content))',
          },
          'chip-destructive': {
            DEFAULT: 'hsl(var(--chip-destructive))',
            border: 'hsl(var(--chip-destructive-border))',
            content: 'hsl(var(--chip-destructive-content))',
          },
          'chip-warning': {
            DEFAULT: 'hsl(var(--chip-warning))',
            border: 'hsl(var(--chip-warning-border))',
            content: 'hsl(var(--chip-warning-content))',
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
