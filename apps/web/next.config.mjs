/** @type {import('next').NextConfig} */
const nextConfig = {
  // All pages read the persona cookie, so the app is request-rendered by nature.
  reactStrictMode: true,
};

export default nextConfig;
