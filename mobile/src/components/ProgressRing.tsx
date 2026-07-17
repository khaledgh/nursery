import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, fonts } from "../theme";

interface ProgressRingProps {
  pct: number; // 0–100
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: ReactNode; // center content; defaults to "NN%"
  labelColor?: string;
}

/** Circular progress indicator used in hero cards and week strips. */
export function ProgressRing({
  pct,
  size = 72,
  stroke = 8,
  color = colors.primary,
  trackColor = "rgba(124,58,237,0.15)",
  label,
  labelColor = colors.text,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        {label ?? (
          <Text style={[styles.pct, { fontSize: size * 0.24, color: labelColor }]}>{clamped}%</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pct: { fontFamily: fonts.extrabold },
});
