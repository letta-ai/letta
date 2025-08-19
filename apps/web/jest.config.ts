
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

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
    '../../libs/service-database-testing/src/index.ts',
    '../../libs/sdk-core-testing/src/index.ts',
    './testing/always-mocks.ts',
  ],
  moduleNameMapper: {
    'nanoid':  '<rootDir>/testing/empty.ts',
  },
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/web',
};

export default createJestConfig(config);
