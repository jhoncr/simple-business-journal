module.exports = {
  root: true,
  env: {
    es2021: true, // Use es2021 instead of es6.
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"], // Good!  Specifies your TypeScript config.
    sourceType: "module",
    tsconfigRootDir: __dirname, // VERY IMPORTANT:  Add this line!
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "**/*.js",
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    estimates: ["error", "double"],
    "import/no-unresolved": 0,
    // "indent": ["error", 2],
    indent: "off",
    "max-len": ["error", { code: 120 }],
    "object-curly-spacing": ["error", "always"],
    // "estimate-props": ["error", "as-needed"],
    "valid-jsdoc": "off",
  },
};
