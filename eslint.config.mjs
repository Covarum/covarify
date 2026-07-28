import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/**", ".next-build/**", ".release-*/**", ".codex-kms-deploy-*/**", "node_modules/**"],
  },
  ...nextVitals,
  ...nextTs,
];

export default eslintConfig;
