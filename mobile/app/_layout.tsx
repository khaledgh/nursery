import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import "../src/i18n";
import { colors, fonts } from "../src/theme";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Hide the Android system navigation bar (swipe up from the bottom edge
  // to reveal it temporarily) so the app is full-screen like the designs.
  useEffect(() => {
    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden");
    }
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
          headerTitleAlign: "center",
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="child/feed" options={{ title: t("feed.title") }} />
        <Stack.Screen name="child/sleep" options={{ title: t("sleep.title") }} />
        <Stack.Screen name="child/diaper" options={{ title: t("diaper.title") }} />
        <Stack.Screen name="child/health" options={{ title: t("health.title") }} />
        <Stack.Screen name="child/milestones" options={{ title: t("milestones.title") }} />
        <Stack.Screen name="child/report" options={{ title: t("report.title") }} />
        <Stack.Screen name="child/meals-schedule" options={{ title: t("menu.title") }} />
        <Stack.Screen name="events/index" options={{ title: t("events.title") }} />
        <Stack.Screen name="events/[id]" options={{ title: t("events.detailTitle") }} />
        <Stack.Screen name="payments/index" options={{ title: t("payments.title") }} />
        <Stack.Screen name="message/[id]" options={{ title: t("messages.detailTitle") }} />
        <Stack.Screen name="notifications" options={{ title: t("notifications.title") }} />
        <Stack.Screen name="classroom" options={{ title: t("classroom.title") }} />
        <Stack.Screen name="community" options={{ title: t("community.title") }} />
        <Stack.Screen name="reminders" options={{ title: t("reminders.title") }} />
      </Stack>
    </QueryClientProvider>
  );
}
