import pluginNext from "@next/eslint-plugin-next";
import reactUIConfig from "./eslint.react-ui.mjs";

// @ts-check
export default [
  ...reactUIConfig,
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
