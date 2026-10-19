import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheStartUrl: false,
  extendDefaultRuntimeCaching: false,
  cacheOnFrontEndNav: false,
  reloadOnOnline: false,
  fallbacks: { document: "/offline.html" },
  workboxOptions: {
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith("/_next/static/"),
        handler: "CacheFirst",
        options: {
          cacheName: "brew-static",
          expiration: { maxEntries: 128, maxAgeSeconds: 2592000 },
        },
      },
      {
        urlPattern: ({ url, sameOrigin, request }) =>
          sameOrigin &&
          request.mode === "navigate" &&
          url.pathname === "/" &&
          !url.search,
        handler: "NetworkFirst",
        options: {
          cacheName: "brew-shell",
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 1 },
        },
      },
    ],
  },
});

export default withPWA({
  compiler: { styledComponents: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
});
