import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Covarify",
  slug: "covarify-mobile",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "covarify",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.covarify.mobile",
  },
  android: {
    package: "com.covarify.mobile",
  },
  plugins: ["expo-router", "expo-secure-store"],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
