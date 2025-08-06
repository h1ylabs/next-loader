import js from "@eslint/js";
import prettierPlugin from "eslint-config-prettier";
import onlyWarnPlugin from "eslint-plugin-only-warn";
import importSortPlugin from "eslint-plugin-simple-import-sort";
import turboPlugin from "eslint-plugin-turbo";
import ts from "typescript-eslint";

// @ts-check
export default ts.config(
  // base plugin: ESLint, Prettier, TypeScript
  js.configs.recommended,
  ...ts.configs.recommended,
  prettierPlugin,

  // turborepo: eslint rules for turborepo options
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // simple-import-sort: automatically sorts import and export statements
  {
    plugins: {
      "simple-import-sort": importSortPlugin,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },

  /**
   * always shows warnings instead of errors for code formatting.
   * INFO: use "--max-warnings=0" when running lint to enforce warnings as errors.
   */
  {
    plugins: {
      onlyWarn: onlyWarnPlugin,
    },
  },

  // files to exclude from linting
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
);
