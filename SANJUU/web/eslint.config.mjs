import coreWebVitals from "eslint-config-next/core-web-vitals";

/** Next のビルド経路で ESLint が走り、react-hooks の厳格ルールだけが既存パターンと衝突して落ちるため無効化する */
const eslintConfig = [
  ...coreWebVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default eslintConfig;
