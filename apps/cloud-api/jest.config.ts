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
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    ...moduleNameMapper,
    '@t3-oss/env-nextjs': '<rootDir>/__mocks__/empty.ts',
  },
  coverageDirectory: '../../coverage/libs/service-auth',
};
