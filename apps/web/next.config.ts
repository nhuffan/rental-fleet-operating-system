import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repository's manual AGENTS instructions; do not recreate CLAUDE.md.
  agentRules: false,
  // Recovery links and password action arguments are credentials.
  logging: {
    incomingRequests: { ignore: [/\/auth\/confirm(?:\?|$)/] },
    serverFunctions: false,
  },
};

export default nextConfig;
