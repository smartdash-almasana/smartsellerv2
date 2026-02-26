const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Suppress workspace root warning — smartseller-v2 is a standalone nested Next.js app
    outputFileTracingRoot: path.join(__dirname),
    images: {
        remotePatterns: [],
    },
};
module.exports = nextConfig;
