/* eslint-disable @typescript-eslint/no-require-imports -- Jest config must be CommonJS */
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const nextTransform = {
  '^.+\\.(ts|tsx|js|jsx|mjs)$': ['next/dist/build/swc/jest-transformer', {}],
};

/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
      testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
      transform: nextTransform,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['**/tests/integration/**/*.test.ts'],
      setupFiles: ['<rootDir>/jest.setup.ws.js'],
      transform: nextTransform,
    },
  ],
};

module.exports = createJestConfig(config);
