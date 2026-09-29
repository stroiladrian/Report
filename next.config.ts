import type { NextConfig } from "next";
import { branding } from "./config/branding";

const mapOrigin = new URL(branding.map.styleUrl).origin;
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Map tiles/fonts/sprites come from the configured style host.
 * 'unsafe-inline' for scripts is required by Next.js inline bootstrap scripts unless a nonce
 * middleware is added (see README → Security hardening).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${mapOrigin}`,
  `connect-src 'self' ${mapOrigin}${isDev ? " ws:" : ""}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Lets phones/tablets on your Wi-Fi open the dev server via the Mac's IP address.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local", "*.trycloudflare.com"],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
