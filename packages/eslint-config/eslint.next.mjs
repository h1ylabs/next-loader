import pluginNext from "@next/eslint-plugin-next";
import reactConfig from "./eslint.react.mjs";

// @ts-check
export default [
  ...reactConfig,
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
];
