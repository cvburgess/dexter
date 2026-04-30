module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/app/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFiles: ["./jest.setup.js"],
};
