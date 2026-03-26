import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["app"],
  }),
};

export default withNextIntl(nextConfig);
