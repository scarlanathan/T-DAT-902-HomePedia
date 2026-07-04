import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["maplibre-gl", "react-map-gl"],
  devIndicators: false,
};

export default nextConfig;
