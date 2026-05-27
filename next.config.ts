import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase", "@firebase/app", "@firebase/firestore"],
  turbopack: {
    root: ".",
  },
};

export default nextConfig;
