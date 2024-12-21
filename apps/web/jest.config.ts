/* eslint-disable */
import type { Config } from 'jest';
import nextJest from 'next/jest.js';
import { pathsToModuleNameMapper } from 'ts-jest';
const createJestConfig = nextJest({
  dir: __dirname,
});

const config: Config = {
  displayName: 'web',
  preset: '../../jest.preset.js',
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/next/babel'] }],
  },
  setupFilesAfterEnv: [
    '../../libs/database-testing/src/index.ts',
    '../../libs/letta-agents-api-testing/src/index.ts',
    './testing/always-mocks.ts',
  ],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/web',
};

export default createJestConfig(config);
