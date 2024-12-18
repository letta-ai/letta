import type { StorybookConfig } from '@storybook/react-vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

const config: StorybookConfig = {
  stories: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-styling-webpack',
    '@storybook/addon-themes',
    'storybook-next-intl',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  docs: {
    defaultName: 'Documentation',
  },
  viteFinal: async (config) => {
    const nextConfig = mergeConfig(config, {
      plugins: [react(), nxViteTsPaths()],
    });

    nextConfig.resolve.alias = {
      ...nextConfig.resolve.alias,
      'next/link': path.resolve(__dirname, '..', 'src', 'stubs', 'Link.tsx'),
    };

    return nextConfig;
  },
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
