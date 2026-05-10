import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** `SANJUU/web` のひとつ上（`SANJUU/` ws と共有するロック／node の境界） */
const monorepoRoot = join(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
