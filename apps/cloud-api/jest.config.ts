/* eslint-disable @nx/enforce-module-boundaries */
import tsconfig from '../../tsconfig.base.json';
const moduleNameMapper = require('tsconfig-paths-jest')(tsconfig);

// loop throuhg moduleNameMapper and add ../.. after <rootDir> to make it work
for (const key in moduleNameMapper) {
  moduleNameMapper[key] = moduleNameMapper[key].replace(
    '<rootDir>',
    '<rootDir>/../..',
  );
}

export default {
  displayName: 'cloud-api-stability',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '../../node_modules'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx'],
  moduleNameMapper: {
    ...moduleNameMapper,
    '@t3-oss/env-nextjs': '<rootDir>/__mocks__/empty.ts',
    'lodash-es': 'lodash',
    'nanoid':  '<rootDir>/__mocks__/nanoid.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/e2e/test-setup.ts'],
  coverageDirectory: '../../coverage/libs/service-auth',
};
