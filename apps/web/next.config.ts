import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repository's manual AGENTS instructions; do not recreate CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
