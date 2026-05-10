/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 上の next build が ESLint で落ちるケースを避ける（CI / npm run lint はそのまま）
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
