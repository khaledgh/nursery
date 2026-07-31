import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { tabScreenOptions } from "../../src/components/tabBarOptions";
import { useAuthStore } from "../../src/store/auth";

type IconName = keyof typeof Ionicons.glyphMap;

// Four tabs rather than five: the targets stay large for one-handed use while
// holding a child, and staff messaging lives behind "More" for now.
const TABS: { name: string; key: string; icon: IconName; iconActive: IconName }[] = [
  { name: "index", key: "teacher.tabs.today", icon: "today-outline", iconActive: "today" },
  { name: "log", key: "teacher.tabs.quickLog", icon: "flash-outline", iconActive: "flash" },
  { name: "class", key: "teacher.tabs.class", icon: "school-outline", iconActive: "school" },
  { name: "more", key: "teacher.tabs.more", icon: "menu-outline", iconActive: "menu" },
];

export default function TeacherLayout() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);

  if (!accessToken) return <Redirect href="/(auth)/login" />;
  // Defence in depth: the route group is only reachable by staff, so a parent
  // following a stale deep link cannot render a data-entry screen. The backend
  // scopes every write regardless; this keeps the UI honest too.
  if (role !== "teacher" && role !== "admin") return <Redirect href="/(tabs)" />;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            headerShown: tab.name !== "index", // Today renders its own header
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
