import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Covarify",
  slug: "covarify",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "covarify",
  userInterfaceStyle: "automatic",
  extra: {
    eas: {
      projectId: "e255c1b0-3cde-487c-ba62-8d3dcc8e7d0d",
    },
  },
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