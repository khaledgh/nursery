import { Ionicons } from "@expo/vector-icons";
import { I18nManager } from "react-native";
import { colors } from "../theme";

/** Trailing arrow telling the user a row opens another screen (mirrors in RTL). */
export function Chevron({ color = colors.textMuted, size = 18 }: { color?: string; size?: number }) {
  return <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={size} color={color} />;
}
