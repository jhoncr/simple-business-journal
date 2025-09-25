// import { NextConfig } from "next";
const createNextIntlPlugin = require("next-intl/plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
};

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");
module.exports = withNextIntl(nextConfig);
