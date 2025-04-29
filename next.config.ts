// next.config.ts
import nextPwa from "next-pwa";

const withPWA = nextPwa({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // Disable PWA in dev for easier debugging
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
    webpackBuildWorker: true,
    optimizeCss: true,
    optimisticClientCache: true,
    optimizeServerReact: true,
    nextScriptWorkers: true,
  },

  // Your existing config here
  reactStrictMode: true, // Recommended
};

export default withPWA(nextConfig);
