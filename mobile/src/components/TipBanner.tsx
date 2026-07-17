import { StyleSheet, Text, View } from "react-native";
import { accents, colors, radius, spacing, type Accent, type AccentName } from "../theme";
import { IconCircle } from "./IconCircle";

interface TipBannerProps {
  icon?: string;
  accent?: AccentName | Accent;
  title?: string;
  text: string;
}

/** Tinted info banner ("Tip from Teacher", hydration tips…). */
export function TipBanner({ icon = "bulb", accent = "primary", title, text }: TipBannerProps) {
  const a: Accent = typeof accent === "string" ? accents[accent] : accent;
  return (
    <View style={[styles.banner, { backgroundColor: a.tint }]}>
      <IconCircle name={icon} accent={accent} size={36} />
      <View style={styles.texts}>
        {title ? <Text style={[styles.title, { color: a.dark }]}>{title}</Text> : null}
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontFamily: "Nunito_800ExtraBold" },
  text: { fontSize: 13, fontFamily: "Nunito_600SemiBold", color: colors.text, lineHeight: 18 },
});
