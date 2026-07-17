import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { IconCircle } from "./IconCircle";
import { GhostButton } from "./Buttons";

interface EmptyStateProps {
  icon?: string;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = "sparkles", title, text, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <IconCircle name={icon} accent="primary" size={56} />
      <Text style={styles.title}>{title}</Text>
      {text && <Text style={styles.text}>{text}</Text>}
      {actionLabel && onAction && <GhostButton label={actionLabel} onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  title: { ...type.h3 },
  text: { ...type.body, color: colors.textMuted, textAlign: "center" },
});
