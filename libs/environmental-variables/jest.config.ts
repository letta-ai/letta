/* eslint-disable */
import { pathsToModuleNameMapper } from 'ts-jest';

export default {
  displayName: 'environmental-variables',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/environmental-variables',
};
