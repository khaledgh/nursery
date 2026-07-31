import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActionCard } from "../../src/components/ActionCard";
import { Screen } from "../../src/components/ui";

/** Classroom-level tools, as opposed to the per-child logging on Today. */
export default function TeacherClass() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen>
      <ActionCard
        icon="restaurant"
        accent="meals"
        title={t("menu.title")}
        onPress={() => router.push("/child/meals-schedule")}
      />
      <ActionCard
        icon="school"
        accent="diaper"
        title={t("home.classroom")}
        onPress={() => router.push("/classroom")}
      />
      <ActionCard
        icon="calendar"
        accent="events"
        title={t("home.events")}
        onPress={() => router.push("/events")}
      />
      <ActionCard
        icon="megaphone"
        accent="primary"
        title={t("messages.title")}
        onPress={() => router.push("/(tabs)/messages")}
      />
    </Screen>
  );
}
