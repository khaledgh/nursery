// Static JSON cannot read env vars, so the config is a JS module: EXPO_PUBLIC_API_URL
// from .env is baked into extra.apiUrl at build time. Unset means client.ts falls
// back to the Metro dev-server host (see resolveBaseURL).
module.exports = {
  expo: {
    name: "Nursee+",
    slug: "nursee-plus",
    scheme: "nurseeplus",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    primaryColor: "#2CAFA8",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.nurseeplus",
      buildNumber: "4",
      infoPlist: {
        // Lets a push wake the app to fetch before the notification is shown.
        UIBackgroundModes: ["remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
      },
      entitlements: {
        // Switched to "production" by the plugin's production mode at build time.
        "aps-environment": "development",
      },
    },
    android: {
      package: "com.nurseeplus",
      versionCode: 3,
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
          // Android 12+ draws the splash icon on a 288dp canvas and shows only
          // its inner 2/3 circle, so the asset keeps the logo inside that circle
          // with transparent padding. 288 makes iOS and older Android match.
          imageWidth: 288,
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
      "expo-sharing",
      [
        "expo-media-library",
        {
          photosPermission: "Allow $(PRODUCT_NAME) to save photos to your library.",
          savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos to your library."
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://nurseeplus.gonext.tech/api",
      oneSignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? "f04b30a6-6386-41a4-9a50-05f846e2574b",
      eas: {
        projectId: "61818b12-0e7c-4495-b6d8-3e6ce2851119",
      },
    },
  },
};
