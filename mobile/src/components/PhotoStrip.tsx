import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../theme";

export interface StripPhoto {
  url: string;
  caption?: string;
  sub?: string;
}

interface PhotoStripProps {
  photos: StripPhoto[];
  size?: number;
  max?: number;
  onPressMore?: () => void;
}

/** Horizontal photo thumbnails with optional captions and a "+N" overflow tile. */
export function PhotoStrip({ photos, size = 96, max = 8, onPressMore }: PhotoStripProps) {
  const shown = photos.slice(0, max);
  const extra = photos.length - shown.length;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {shown.map((photo, i) => (
        <View key={i} style={{ width: photo.caption ? size + 32 : size }}>
          <Image source={{ uri: photo.url }} style={[styles.photo, { width: "100%", height: size }]} contentFit="cover" transition={150} />
          {photo.caption ? (
            <Text style={styles.caption} numberOfLines={2}>
              {photo.caption}
            </Text>
          ) : null}
          {photo.sub ? <Text style={styles.sub}>{photo.sub}</Text> : null}
        </View>
      ))}
      {extra > 0 && (
        <Pressable onPress={onPressMore} style={[styles.more, { width: size * 0.8, height: size }]}>
          <Text style={styles.moreText}>+{extra}</Text>
          <Text style={styles.moreSub}>more</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  photo: { borderRadius: radius.md },
  caption: { fontSize: 11, fontFamily: fonts.bold, color: colors.text, marginTop: 4 },
  sub: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted },
  more: {
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.primaryDark },
  moreSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.primaryDark },
});
