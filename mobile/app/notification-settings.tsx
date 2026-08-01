import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useNotificationSettings, useUpdateNotificationSettings } from "../src/api/hooks";
import { Card, Loading, Screen } from "../src/components/ui";
import { colors, fonts, spacing } from "../src/theme";

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const settingsQuery = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [messagesEnabled, setMessagesEnabled] = useState(true);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [eventsEnabled, setEventsEnabled] = useState(true);

  useEffect(() => {
    if (settingsQuery.data) {
      setPushEnabled(settingsQuery.data.push_enabled);
      setMessagesEnabled(settingsQuery.data.messages_enabled);
      setAnnouncementsEnabled(settingsQuery.data.announcements_enabled);
      setRemindersEnabled(settingsQuery.data.reminders_enabled);
      setEventsEnabled(settingsQuery.data.events_enabled);
    }
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const toggleSetting = (key: string, val: boolean) => {
    let nextPush = pushEnabled;
    let nextMsg = messagesEnabled;
    let nextAnn = announcementsEnabled;
    let nextRem = remindersEnabled;
    let nextEvt = eventsEnabled;

    if (key === "push_enabled") { setPushEnabled(val); nextPush = val; }
    if (key === "messages_enabled") { setMessagesEnabled(val); nextMsg = val; }
    if (key === "announcements_enabled") { setAnnouncementsEnabled(val); nextAnn = val; }
    if (key === "reminders_enabled") { setRemindersEnabled(val); nextRem = val; }
    if (key === "events_enabled") { setEventsEnabled(val); nextEvt = val; }

    updateSettings.mutate({
      push_enabled: nextPush,
      messages_enabled: nextMsg,
      announcements_enabled: nextAnn,
      reminders_enabled: nextRem,
      events_enabled: nextEvt,
    });
  };

  return (
    <Screen>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Allow Push Notifications</Text>
            <Text style={styles.subtitle}>Master toggle for all push notifications</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={(v) => toggleSetting("push_enabled", v)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </Card>

      <Card style={[styles.card, !pushEnabled ? styles.disabledCard : {}]}>
        <Text style={styles.sectionHeader}>Notification Categories</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Direct Messages</Text>
            <Text style={styles.subtitle}>Chat alerts from teachers and administration</Text>
          </View>
          <Switch
            disabled={!pushEnabled}
            value={messagesEnabled}
            onValueChange={(v) => toggleSetting("messages_enabled", v)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Announcements</Text>
            <Text style={styles.subtitle}>Updates and broadcast news</Text>
          </View>
          <Switch
            disabled={!pushEnabled}
            value={announcementsEnabled}
            onValueChange={(v) => toggleSetting("announcements_enabled", v)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Reminders & Invoices</Text>
            <Text style={styles.subtitle}>What to bring and monthly payment due dates</Text>
          </View>
          <Switch
            disabled={!pushEnabled}
            value={remindersEnabled}
            onValueChange={(v) => toggleSetting("reminders_enabled", v)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Events & Activities</Text>
            <Text style={styles.subtitle}>Upcoming school events and meetups</Text>
          </View>
          <Switch
            disabled={!pushEnabled}
            value={eventsEnabled}
            onValueChange={(v) => toggleSetting("events_enabled", v)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  disabledCard: { opacity: 0.5 },
  sectionHeader: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.textMuted, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  title: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border },
});
