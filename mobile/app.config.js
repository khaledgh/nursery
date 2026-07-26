// Static JSON cannot read env vars, so the config is a JS module: EXPO_PUBLIC_API_URL
// from .env is baked into extra.apiUrl at build time. Unset means client.ts falls
// back to the Metro dev-server host (see resolveBaseURL).
module.exports = {
  expo: {
    name: "Sunny Stars",
    slug: "sunny-stars",
    scheme: "sunnystars",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.sunnystars.mobile",
    },
    android: {
      package: "app.sunnystars.mobile",
      adaptiveIcon: {
        backgroundColor: "#6d28d9",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-localization",
      "expo-image",
      "expo-font",
      "expo-splash-screen",
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
    },
  },
};
