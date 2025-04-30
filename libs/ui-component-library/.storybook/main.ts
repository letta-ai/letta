import type { StorybookConfig } from '@storybook/react-vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import React from 'react';

const config: StorybookConfig = {
  stories: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-styling-webpack',
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
      define: { 'process.env': {} },
    });

    nextConfig.resolve.alias = {
      ...nextConfig.resolve.alias,
      path: () => require.resolve('path-browserify'),
      'next/image': () => React.createElement('div'),
      'next/link': () => React.createElement('div'),
    };

    return nextConfig;
  },
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
