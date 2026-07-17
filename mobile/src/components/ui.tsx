import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { colors, radius, shadows, spacing, type } from "../theme";

interface ScreenProps extends PropsWithChildren {
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}

export function Screen({ children, refreshing, onRefresh, padded = true }: ScreenProps) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, !padded && { padding: 0 }]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={styles.infoValue}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function UnreadDot({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;
  return <View style={styles.unreadDot} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 96 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitle: { ...type.h2, fontSize: 16, marginBottom: spacing.xs },
  loading: { paddingVertical: spacing.xl },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  infoLabel: { ...type.body, color: colors.textMuted },
  infoValue: { ...type.label },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
