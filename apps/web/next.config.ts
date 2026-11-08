import type { NextConfig } from "next";

// Framing, referrers and powerful browser features are denied. A full CSP needs nonces for the
// theme initializer and Leaflet tiles, so it is tracked in the launch checklist instead.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Keep the repository's manual AGENTS instructions; do not recreate CLAUDE.md.
  agentRules: false,
  // Recovery links and password action arguments are credentials.
  logging: {
    incomingRequests: { ignore: [/\/auth\/confirm(?:\?|$)/] },
    serverFunctions: false,
  },
};

export default nextConfig;
