import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
import reactQueryPlugin from "@tanstack/eslint-plugin-query";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import readableTailwindPlugin from "eslint-plugin-readable-tailwind";
import globals from "globals";
import baseConfig from "./eslint.base.mjs";

// @ts-check
export default [
  ...baseConfig,
  ...reactQueryPlugin.configs["flat/recommended"],
  reactPlugin.configs.flat.recommended,

  // 접근성 관련 규칙
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

      // <img> 엘리먼트에 유의미한 대체 텍스트가 있는지 체크합니다.
      "jsx-a11y/alt-text": [
        "error",
        {
          elements: ["img"],
        },
      ],

      // 유효한 aria-* 속성만 사용합니다.
      "jsx-a11y/aria-props": "error",

      // 유효한 aria-* 상태/값만 사용합니다.
      "jsx-a11y/aria-proptypes": "error",

      // DOM에서 지원되는 role, ARIA만 사용합니다.
      "jsx-a11y/aria-unsupported-elements": "error",

      // 필수 ARIA 속성이 빠져있는지 체크합니다.
      "jsx-a11y/role-has-required-aria-props": "error",

      // ARIA 속성은 지원되는 role에서만 사용합니다.
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
      globals: { ...globals.browser, ...globals.serviceworker, },
    },
    rules: {
      ...readableTailwindPlugin.configs.warning.rules,
      ...readableTailwindPlugin.configs.error.rules,
      "readable-tailwind/multiline": ["error", { printWidth: 80 }],
    },
  },

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
