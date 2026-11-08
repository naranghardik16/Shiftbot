import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets a phone on the LAN load the dev server (`next dev -H 0.0.0.0`)
  allowedDevOrigins: ["192.168.4.67"],
  // The Daytona SDK loads form-data with a dynamic require for file uploads,
  // which breaks once bundled; load it with Node's own require instead
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
