import type { NextConfig } from "next";

function configuredSupabaseOrigin(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

const connectSources = ["'self'", configuredSupabaseOrigin()].filter(Boolean).join(" ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              `connect-src ${connectSources}`,
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
