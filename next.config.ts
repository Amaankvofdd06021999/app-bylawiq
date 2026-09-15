import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() { return [{ source: '/:path*', headers: [
    {key:'X-Content-Type-Options',value:'nosniff'}, {key:'Referrer-Policy',value:'same-origin'},
    {key:'X-Frame-Options',value:'DENY'}, {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Cache-Control',value:'private, no-store'},
  ]}]; },
};
export default config;
