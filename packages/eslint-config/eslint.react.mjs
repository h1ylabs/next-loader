import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import reactQueryPlugin from "@tanstack/eslint-plugin-query";
import baseConfig from "./eslint.base.mjs";

// @ts-check
export default [
  ...baseConfig,
  ...reactQueryPlugin.configs["flat/recommended"],
  reactPlugin.configs.flat.recommended,

  {
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,

      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },
];
