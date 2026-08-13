// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tseslint = require("typescript-eslint");

module.exports = defineConfig([
  expoConfig,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        require: "readonly",
        module: "writable",
      },
    },
  },
  {
    // `lint` walks all of /src, so generated output and the native projects
    // (both gitignored) have to be excluded explicitly — flat config has no
    // knowledge of .gitignore.
    ignores: ["dist/**", ".expo/**", "ios/**", "android/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
    },
  },
  {
    // Test code talks to Jest mocks, which are untyped by construction: a
    // `jest.mock` factory is hoisted above the imports (so it must `require`),
    // and a mocked module's shape comes back as `any`. Typing every one of
    // those boundaries would mean a cast at each call site to restate what the
    // mock already declares, so the `no-unsafe-*` family and `no-require-imports`
    // are off here.
    //
    // Everything else stays on, deliberately. Rules that catch real mistakes in
    // tests are worth the handful of fixes they cost: `rules-of-hooks` (name
    // mock components in PascalCase), `react/display-name` (give stubs a named
    // function), `require-await`, `no-unused-vars`, `import/no-duplicates`,
    // `no-misused-promises`. A test harness with a conditional hook should fail
    // lint, not surface later as a flaky test.
    //
    // Tests all live in `__tests__/` directories (see CLAUDE.md), so that glob
    // plus the shared-infrastructure files is the whole surface.
    files: [
      "**/__tests__/**",
      "testUtils/**",
      "jest.setup.js",
      "jest.setupAfterEnv.js",
    ],
    languageOptions: {
      // The jest setup files are plain JS, so `@types/jest` globals never
      // reach them.
      globals: { jest: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
]);
