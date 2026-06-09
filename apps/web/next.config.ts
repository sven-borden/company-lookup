import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Emit a self-contained server with only the traced node_modules.
  // Shrinks the Docker runtime image from ~1GB to ~150MB.
  output: "standalone",
  // In a monorepo, trace files from the repo root so the workspace
  // package (@swiss-biz-hunter/types) and hoisted deps are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
