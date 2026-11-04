import type { NextConfig } from 'next';

/**
 * The demo is a static site: all data is generated in the browser from the
 * sample season, and admin changes live in localStorage. No server, no real
 * family data. `basePath` can be set for GitHub Pages via NEXT_PUBLIC_BASE_PATH.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const config: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@bvac/core', '@bvac/engine', '@bvac/schedule', '@bvac/se-bridge', '@bvac/seed'],
};

export default config;
