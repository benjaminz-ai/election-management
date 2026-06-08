import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase", "@firebase/app", "@firebase/firestore"],
  turbopack: {
    root: ".",
  },
  // Don't fail the production build on ESLint findings (e.g. react-hooks
  // best-practice rules that a fresh install may flag as errors). TypeScript
  // type-checking still runs and must pass. Run `npm run lint` separately.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
