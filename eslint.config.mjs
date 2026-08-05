import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const baseConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", ".agent/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default baseConfig;