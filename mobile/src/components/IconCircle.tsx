import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { accents, type Accent, type AccentName } from "../theme";

interface IconCircleProps {
  name: string;
  accent?: AccentName | Accent;
  size?: number;
  squircle?: boolean;
}

/** Vector icon inside a tinted circle/squircle — the design's core motif. */
export function IconCircle({ name, accent = "primary", size = 40, squircle = false }: IconCircleProps) {
  const a: Accent = typeof accent === "string" ? accents[accent] : accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: squircle ? size * 0.32 : size / 2,
        backgroundColor: a.tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size * 0.5} color={a.main} />
    </View>
  );
}
