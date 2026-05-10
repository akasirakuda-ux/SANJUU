import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Git ルートは `SANJUU/web` から 2 段上（このリポジトリはらくだ本体 + `SANJUU/` を同居） */
const monorepoRoot = join(__dirname, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
