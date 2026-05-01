module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/app/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFiles: ["./jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|react-clone-referenced-element|@react-navigation|expo|expo-.+|@expo(nent)?/.*|@expo-google-fonts/.*|camelcase|camelcase-keys|decamelize|decamelize-keys|map-obj|quick-lru)/)",
  ],
};
