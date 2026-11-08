import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The Daytona SDK loads form-data with a dynamic require for file uploads,
  // which breaks once bundled; load it with Node's own require instead
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
