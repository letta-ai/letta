import type { StorybookConfig } from '@storybook/react-vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
      path: 'path-browserify', // fixes `[ERROR] require is not defined [plugin vite:dep-pre-bundle]` when running `npm run cl`
      'next/image': require.resolve('../.storybook/mocks/next-image.js'),
      'next/link': require.resolve('../.storybook/mocks/next-link.js'),
      'next/navigation': require.resolve(
        '../.storybook/mocks/next-navigation.js',
      ),
    };

    return nextConfig;
  },
};

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
