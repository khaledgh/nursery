// Static JSON cannot read env vars, so the config is a JS module: EXPO_PUBLIC_API_URL
// from .env is baked into extra.apiUrl at build time. Unset means client.ts falls
// back to the Metro dev-server host (see resolveBaseURL).
module.exports = {
  expo: {
    name: "Little Talent Childcare",
    // slug/scheme/bundle identifiers stay on the original values: changing them
    // would break the EAS project link and the existing store listings.
    slug: "sunny-stars",
    scheme: "sunnystars",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.sunnystars.mobile",
      infoPlist: {
        // Lets a push wake the app to fetch before the notification is shown.
        UIBackgroundModes: ["remote-notification"],
      },
      entitlements: {
        // Switched to "production" by the plugin's production mode at build time.
        "aps-environment": "development",
      },
    },
    android: {
      package: "app.sunnystars.mobile",
      adaptiveIcon: {
        // White to match the logo artwork, which is drawn for a white ground.
        backgroundColor: "#ffffff",
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
      // Must stay first in this array, otherwise the iOS build fails with
      // "OneSignal/OneSignal.h file not found".
      [
        "onesignal-expo-plugin",
        {
          mode: process.env.NODE_ENV === "production" ? "production" : "development",
          // This app never asks for location, so keep that dependency out.
          disableLocation: true,
          // Android renders the small icon as a flat white silhouette on
          // transparency and discards colour, so this is a purpose-built
          // monochrome mark — the full-colour logo would show as a white blob.
          smallIcons: ["./assets/notification-icon.png"],
          largeIcons: ["./assets/notification-icon-large.png"],
        },
      ],
      "expo-router",
      "expo-secure-store",
      "expo-localization",
      "expo-image",
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 578,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow $(PRODUCT_NAME) to access your photos so you can add pictures to a child's diary.",
          cameraPermission:
            "Allow $(PRODUCT_NAME) to use the camera so you can photograph a child's activity.",
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
      oneSignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? "",
    },
  },
};
