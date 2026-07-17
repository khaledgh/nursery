import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

interface ChildAvatarProps {
  url?: string | null;
  name: string;
  size?: number;
  ringColor?: string;
}

/** Remote photo with an initials fallback, optionally ringed. */
export function ChildAvatar({ url, name, size = 48, ringColor }: ChildAvatarProps) {
  const ring = ringColor ? { borderWidth: 2, borderColor: ringColor } : null;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, ring]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
        ring,
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.primaryDark, fontFamily: fonts.extrabold },
});
