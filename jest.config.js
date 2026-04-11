/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  testMatch: ["**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.js$"],
  roots: ["<rootDir>/src"],
};
