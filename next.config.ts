import type { NextConfig } from "next";

const isEdgeOneBuild = process.env.EDGEONE_PAGES === "1";

const nextConfig: NextConfig = isEdgeOneBuild
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
