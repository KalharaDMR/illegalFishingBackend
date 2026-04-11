/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  testMatch: ["**/*.integration.test.js"],
  roots: ["<rootDir>/src"],
  testTimeout: 120000,

  // Coverage for integration runs (separate folder from unit `npm run test:coverage`)
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/**/*.integration.test.js",
  ],
  coverageDirectory: "coverage-integration",
};
