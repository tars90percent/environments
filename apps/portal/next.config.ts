import type { NextConfig } from "next";

const isStandalone = process.env.DEPLOY_TARGET === "railway";

const nextConfig: NextConfig = {
  ...(isStandalone ? { output: "standalone" as const } : {}),
};

export default nextConfig;
