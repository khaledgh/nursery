import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; key: string; icon: IconName; iconActive: IconName }[] = [
  { name: "index", key: "tabs.home", icon: "home-outline", iconActive: "home" },
  { name: "diary", key: "tabs.diary", icon: "book-outline", iconActive: "book" },
  { name: "overview", key: "tabs.overview", icon: "stats-chart-outline", iconActive: "stats-chart" },
  { name: "messages", key: "tabs.messages", icon: "chatbubbles-outline", iconActive: "chatbubbles" },
  { name: "more", key: "tabs.more", icon: "menu-outline", iconActive: "menu" },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 64,
          paddingTop: 6,
          position: "absolute",
          shadowColor: "#7c3aed",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            headerShown: tab.name !== "index", // Home renders its own greeting header
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
