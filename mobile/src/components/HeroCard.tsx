import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, gradients, radius, shadows, spacing } from "../theme";
import { ChildAvatar } from "./ChildAvatar";
import { ProgressRing } from "./ProgressRing";

interface HeroCardProps extends PropsWithChildren {
  variant?: "gradient" | "tint";
  photoUrl?: string | null;
  name?: string;
  title: string;
  subtitle?: string;
  ring?: { pct: number; label: string };
  topRight?: ReactNode;
}

/**
 * Screen-top hero: child photo + status sentence, optional progress ring —
 * purple gradient (feature screens) or lavender tint (lists).
 */
export function HeroCard({ variant = "gradient", photoUrl, name, title, subtitle, ring, topRight, children }: HeroCardProps) {
  const dark = variant === "gradient";
  const content = (
    <View style={styles.row}>
      {name !== undefined && (
        <ChildAvatar url={photoUrl} name={name} size={64} ringColor={dark ? "rgba(255,255,255,0.5)" : colors.primaryLight} />
      )}
      <View style={styles.texts}>
        <Text style={[styles.title, { color: dark ? "#fff" : colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: dark ? "rgba(255,255,255,0.85)" : colors.textMuted }]}>{subtitle}</Text>
        ) : null}
        {children}
      </View>
      {ring && (
        <View style={styles.ringWrap}>
          <ProgressRing
            pct={ring.pct}
            size={76}
            color={dark ? "#fff" : colors.primary}
            trackColor={dark ? "rgba(255,255,255,0.25)" : "rgba(124,58,237,0.15)"}
            labelColor={dark ? "#fff" : colors.text}
          />
          <Text style={[styles.ringLabel, { color: dark ? "rgba(255,255,255,0.85)" : colors.textMuted }]}>{ring.label}</Text>
        </View>
      )}
      {topRight && <View style={styles.topRight}>{topRight}</View>}
    </View>
  );

  if (dark) {
    return (
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, shadows.card]}>
        {content}
      </LinearGradient>
    );
  }
  return <View style={[styles.card, styles.tint, shadows.card]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.md + 2 },
  tint: { backgroundColor: colors.primaryLight },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  texts: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontFamily: fonts.extrabold },
  subtitle: { fontSize: 13, fontFamily: fonts.semibold },
  ringWrap: { alignItems: "center", gap: 4 },
  ringLabel: { fontSize: 11, fontFamily: fonts.semibold },
  topRight: { position: "absolute", top: 0, insetInlineEnd: 0 },
});
