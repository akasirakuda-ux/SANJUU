import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** npm workspaces で `next` が `SANJUU/node_modules` に上がるため、Turbopack の root は親ディレクトリ */
const turbopackRoot = join(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
