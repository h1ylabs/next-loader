import js from "@eslint/js";
import ts from "typescript-eslint";
import prettierPlugin from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import onlyWarnPlugin from "eslint-plugin-only-warn";
import importXPlugin from "eslint-plugin-import-x";
import importSortPlugin from "eslint-plugin-simple-import-sort";

// @ts-check
export default ts.config(
  // Base Plugin: ESLint, Prettier, TypeScript
  js.configs.recommended,
  ...ts.configs.recommended,
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,
  prettierPlugin,

  // Turborepo
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // import 또는 export 순서를 알아서 정렬합니다.
  {
    plugins: {
      "simple-import-sort": importSortPlugin,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    }
  },

  /**
   * 코드 구성 시 무조건 경고로만 표시한다.
   * INFO: lint 수행 시 "--max-warnings 0"를 표기해야 한다.
   */
  {
    plugins: {
      onlyWarn: onlyWarnPlugin,
    },
  },

  // lint 제외 대상
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
);
