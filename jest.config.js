/* eslint-disable @typescript-eslint/no-require-imports -- Jest config must be CommonJS */
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
};

module.exports = createJestConfig(config);
