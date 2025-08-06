import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import readableTailwindPlugin from "eslint-plugin-readable-tailwind";
import globals from "globals";
import reactConfig from "./react.mjs";

// @ts-check
export default [
  ...reactConfig,

  // accessibility rules
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "jsx-a11y": jsxA11yPlugin,
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: { ...globals.serviceworker, ...globals.browser },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...jsxA11yPlugin.flatConfigs.recommended.rules,

      // checks if <img> elements have meaningful alt text
      "jsx-a11y/alt-text": [
        "error",
        {
          elements: ["img"],
        },
      ],

      // only use valid aria-* attributes
      "jsx-a11y/aria-props": "error",

      // only use valid aria-* states/values
      "jsx-a11y/aria-proptypes": "error",

      // only use roles and ARIA supported by DOM
      "jsx-a11y/aria-unsupported-elements": "error",

      // checks if required ARIA attributes are missing
      "jsx-a11y/role-has-required-aria-props": "error",

      // ARIA attributes are only used in supported roles
      "jsx-a11y/role-supports-aria-props": "error",
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "readable-tailwind": readableTailwindPlugin,
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    rules: {
      ...readableTailwindPlugin.configs.warning.rules,
      ...readableTailwindPlugin.configs.error.rules,
      "readable-tailwind/multiline": ["error", { printWidth: 80 }],
    },
  },
];
