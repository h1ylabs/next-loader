import nextJsPlugin from "@next/eslint-plugin-next";
import reactUIConfig from "./react-ui.mjs";

// @ts-check
export default [
  ...reactUIConfig,
  {
    plugins: {
      "@next/next": nextJsPlugin,
    },
    rules: {
      ...nextJsPlugin.configs.recommended.rules,
      ...nextJsPlugin.configs["core-web-vitals"].rules,
    },
  },
];
