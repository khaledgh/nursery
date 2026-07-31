import { useRouter } from "expo-router";
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
] as const;

export default function QuickLog() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.subtitle}>{t("teacher.quickLog.subtitle")}</Text>
      </View>
      <View style={styles.list}>
        {ACTIVITIES.map((a) => (
          <ActionCard
            key={a.kind}
            icon={a.icon}
            accent={a.accent}
            title={t(a.titleKey)}
            subtitle={t(a.descKey)}
            onPress={() => router.push(`/teacher/batch/${a.kind}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingBottom: spacing.sm },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted },
  list: { gap: spacing.sm },
});
