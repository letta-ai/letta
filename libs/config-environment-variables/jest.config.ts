/* eslint-disable */
import { pathsToModuleNameMapper } from 'ts-jest';

export default {
  displayName: 'config-environment-variables',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/config-environment-variables',
};
