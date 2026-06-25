/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server bundle in .next/standalone —
  // required for the multi-stage Docker build.
  output: "standalone",
};

module.exports = nextConfig;
