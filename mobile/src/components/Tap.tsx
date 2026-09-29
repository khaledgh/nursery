import * as Haptics from "expo-haptics";
import { forwardRef } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";

type TapProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** A light vibration on press, for primary actions. */
  haptic?: boolean;
  /** Visual feedback strength; "subtle" for large cards, "normal" otherwise. */
  feedback?: "normal" | "subtle" | "none";
};

const PRESSED: Record<"normal" | "subtle", ViewStyle> = {
  normal: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  subtle: { opacity: 0.85, transform: [{ scale: 0.985 }] },
};

/**
 * Pressable with visible press feedback on both platforms: it dims and
 * shrinks slightly while held (plus a native ripple on Android), so parents
 * can tell at once that something is tappable and that the tap registered.
 */
export const Tap = forwardRef<View, TapProps>(function Tap(
  { style, haptic, feedback = "normal", onPress, android_ripple, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(e) => {
        if (haptic && Platform.OS !== "web") void Haptics.selectionAsync();
        onPress?.(e);
      }}
      android_ripple={android_ripple ?? (feedback === "none" ? undefined : { color: "rgba(0,0,0,0.06)", foreground: true })}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        state.pressed && feedback !== "none" && Platform.OS === "ios" ? PRESSED[feedback] : null,
        state.pressed && feedback !== "none" && Platform.OS === "android" ? { opacity: 0.9 } : null,
      ]}
    />
  );
});
