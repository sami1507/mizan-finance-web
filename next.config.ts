import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "nodemailer"],
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: { "/api/*": ["./drizzle/*.sql"] },
  async headers() { return [{ source: "/(.*)", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
  ] }]; }
};
export default config;
