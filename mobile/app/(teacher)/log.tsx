import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ActionCard } from "../../src/components/ActionCard";
import { Screen } from "../../src/components/ui";
import { colors, fonts, spacing } from "../../src/theme";

/**
 * Quick log inverts the usual navigation: the teacher picks the activity
 * first, then sweeps the whole class in one pass. Logging lunch for a room of
 * 18 is one tap per child here, versus opening and closing 18 child screens.
 */
const ACTIVITIES = [
  { kind: "meal", icon: "restaurant", accent: "meals", titleKey: "teacher.quickLog.meal", descKey: "teacher.quickLog.mealDesc" },
  { kind: "nap", icon: "moon", accent: "sleep", titleKey: "teacher.quickLog.nap", descKey: "teacher.quickLog.napDesc" },
  { kind: "diaper", icon: "shirt", accent: "diaper", titleKey: "teacher.quickLog.diaper", descKey: "teacher.quickLog.diaperDesc" },
  { kind: "report", icon: "document-text", accent: "primary", titleKey: "Daily Report", descKey: "Publish daily report summary & moods for class" },
  { kind: "milestone", icon: "trophy", accent: "meals", titleKey: "Milestones & Badges", descKey: "Award achievement badges & assess skills" },
] as const;

export default function QuickLog() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.subtitle}>{t("teacher.quickLog.subtitle")}</Text>
        {ids ? (
          <Text style={styles.targetCount}>
            Targeting {ids.split(",").filter(Boolean).length} selected children
          </Text>
        ) : null}
      </View>
      <View style={styles.list}>
        {ACTIVITIES.map((a) => (
          <ActionCard
            key={a.kind}
            icon={a.icon}
            accent={a.accent}
            title={a.titleKey.startsWith("teacher.") ? t(a.titleKey) : a.titleKey}
            subtitle={a.descKey.startsWith("teacher.") ? t(a.descKey) : a.descKey}
            onPress={() => {
              if (a.kind === "report") {
                router.push({ pathname: "/teacher/batch/report", params: ids ? { ids } : {} });
              } else if (a.kind === "milestone") {
                router.push({ pathname: "/teacher/batch/milestone", params: ids ? { ids } : {} });
              } else {
                router.push({ pathname: `/teacher/batch/${a.kind}`, params: ids ? { ids } : {} });
              }
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingBottom: spacing.sm },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  targetCount: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary, marginTop: 4 },
  list: { gap: spacing.sm },
});
