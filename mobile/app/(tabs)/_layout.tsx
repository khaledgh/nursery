import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { tabScreenOptions } from "../../src/components/tabBarOptions";
import { useAuthStore } from "../../src/store/auth";

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
  const role = useAuthStore((s) => s.user?.role);
  if (!accessToken) return <Redirect href="/(auth)/login" />;
  // Teachers deep-linked here (push notifications carry a screen + child_id)
  // would otherwise land in the read-only parent UI.
  if (role === "teacher") return <Redirect href="/(teacher)" />;

  return (
    <Tabs screenOptions={tabScreenOptions}>
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
