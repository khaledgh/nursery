import Constants from "expo-constants";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { pushDiagnostics, reRegisterPush } from "../lib/push";
import { colors, fonts, spacing } from "../theme";

/**
 * App version at the bottom of the More tab. Long-pressing it shows what
 * OneSignal knows about this phone (permission, subscription, linked user) —
 * the quickest way to see why a device receives no notifications.
 */
export function VersionFooter() {
  const version = Constants.expoConfig?.version ?? "";

  const showDiagnostics = async () => {
    const d = await pushDiagnostics();
    if (!d.configured) {
      Alert.alert("Push notifications", "OneSignal is not configured in this build.");
      return;
    }
    const linked = d.externalId && d.externalId === d.expectedExternalId;
    const lines = [
      `Platform: ${d.platform}`,
      `Permission granted: ${d.permission ? "yes" : "NO"}`,
      `Subscribed: ${d.optedIn ? "yes" : "NO"}`,
      `Subscription ID: ${d.subscriptionId ?? "none yet"}`,
      `Linked user: ${d.externalId ?? "none"}${linked ? " ✓" : ` (expected ${d.expectedExternalId ?? "?"})`}`,
    ];
    Alert.alert("Push notifications", lines.join("\n"), [
      { text: "Re-register", onPress: () => void reRegisterPush() },
      { text: "OK", style: "cancel" },
    ]);
  };

  return (
    <Pressable onLongPress={() => void showDiagnostics()} delayLongPress={600} hitSlop={8}>
      <Text style={styles.text}>Nursee+ {version}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: "center", fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, paddingVertical: spacing.md },
});
