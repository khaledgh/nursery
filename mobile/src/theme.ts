import type { TextStyle, ViewStyle } from "react-native";

// Official Nursee+ brand palette sampled from the logo:
// Turquoise Teal (#2CAFA8), Royal Violet (#6c5ce7), Warm Marigold (#ffb142), Coral Pink (#ff5e7e), Sky Blue (#00a8ff).
export const colors = {
  primary: "#2CAFA8",
  primaryDark: "#1f7571",
  primaryLight: "#eefbf9",
  secondary: "#6c5ce7",
  secondaryDark: "#4d3ec2",
  secondaryLight: "#ede9fe",
  marigold: "#ffb142",
  marigoldLight: "#fffbeb",
  coral: "#ff5e7e",
  sky: "#00a8ff",
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  white: "#ffffff",
};

export interface Accent {
  main: string;
  tint: string;
  dark: string;
}

/** Per-feature pastel accents: icon color (main), circle fill (tint), text on tint (dark). */
export const accents = {
  // Brand accents matching the Nursee+ logo
  primary: { main: "#2CAFA8", tint: "#eefbf9", dark: "#1f7571" },
  secondary: { main: "#6c5ce7", tint: "#ede9fe", dark: "#4d3ec2" },
  marigold: { main: "#ffb142", tint: "#fffbeb", dark: "#b45309" },
  coral: { main: "#ff5e7e", tint: "#ffe4e6", dark: "#be123c" },
  sky: { main: "#00a8ff", tint: "#e0f2fe", dark: "#0369a1" },

  // Feature specific accents:
  meals: { main: "#f59e0b", tint: "#fef3c7", dark: "#b45309" },
  sleep: { main: "#6366f1", tint: "#e0e7ff", dark: "#4338ca" },
  activity: { main: "#10b981", tint: "#d1fae5", dark: "#047857" },
  diaper: { main: "#8b5cf6", tint: "#ede9fe", dark: "#6d28d9" },
  health: { main: "#ef4444", tint: "#fee2e2", dark: "#b91c1c" },
  payments: { main: "#16a34a", tint: "#dcfce7", dark: "#15803d" },
  hydration: { main: "#3b82f6", tint: "#dbeafe", dark: "#1d4ed8" },
  events: { main: "#ec4899", tint: "#fce7f3", dark: "#be185d" },
  community: { main: "#f97316", tint: "#ffedd5", dark: "#c2410c" },
  neutral: { main: "#6b7280", tint: "#f1f5f9", dark: "#374151" },
} satisfies Record<string, Accent>;

export type AccentName = keyof typeof accents;

export const gradients = {
  hero: ["#2CAFA8", "#6c5ce7"] as const,
  lavender: ["#f5f3ff", "#eefbf9"] as const,
  teal: ["#3ec7be", "#2CAFA8"] as const,
  violet: ["#8b5cf6", "#6c5ce7"] as const,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const fonts = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
};

/** Typography presets — spread into StyleSheet text styles. */
export const type = {
  h1: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text } as TextStyle,
  h2: { fontSize: 18, fontFamily: fonts.bold, color: colors.text } as TextStyle,
  h3: { fontSize: 15, fontFamily: fonts.bold, color: colors.text } as TextStyle,
  body: { fontSize: 14, fontFamily: fonts.regular, color: colors.text } as TextStyle,
  label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text } as TextStyle,
  caption: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted } as TextStyle,
  stat: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.text } as TextStyle,
};

export const shadows = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } as ViewStyle,
};

// ---- Backend enum → presentation maps ----------------------------------
// Labels come from i18n ("enums.*"); these map enum values to visuals.

export interface EnumVisual {
  accent: AccentName;
  icon: string; // Ionicons name
  emoji?: string;
}

export const MEAL_STATUS: Record<string, EnumVisual> = {
  ate_well: { accent: "activity", icon: "checkmark-circle", emoji: "😊" },
  ate_half: { accent: "meals", icon: "contrast", emoji: "🙂" },
  ate_little: { accent: "community", icon: "alert-circle", emoji: "😐" },
  didnt_eat: { accent: "health", icon: "close-circle", emoji: "☹️" },
};

export const MEAL_TYPE: Record<string, EnumVisual> = {
  breakfast: { accent: "meals", icon: "sunny" },
  lunch: { accent: "community", icon: "restaurant" },
  snack: { accent: "diaper", icon: "nutrition" },
  dinner: { accent: "sleep", icon: "moon" },
};

export const WETNESS: Record<string, EnumVisual> = {
  dry: { accent: "activity", icon: "checkmark-circle" },
  wet: { accent: "hydration", icon: "water" },
  heavy: { accent: "meals", icon: "water" },
};

export const STOOL: Record<string, EnumVisual> = {
  none: { accent: "neutral", icon: "remove-circle-outline" },
  hard: { accent: "health", icon: "warning" },
  normal: { accent: "activity", icon: "checkmark-circle" },
  soft: { accent: "meals", icon: "ellipse" },
  loose: { accent: "community", icon: "alert-circle" },
  diarrhea: { accent: "health", icon: "alert-circle" },
};

export const COMFORT: Record<string, EnumVisual> = {
  happy: { accent: "activity", icon: "happy", emoji: "😊" },
  fussy: { accent: "meals", icon: "sad", emoji: "😟" },
};

export const REPORT_RATING: Record<string, EnumVisual> = {
  thriving: { accent: "activity", icon: "happy", emoji: "🤩" },
  doing_well: { accent: "activity", icon: "happy-outline", emoji: "😊" },
  improving: { accent: "meals", icon: "trending-up", emoji: "🙂" },
  needs_support: { accent: "community", icon: "hand-left", emoji: "😐" },
};

export const DIARY_TYPE: Record<string, EnumVisual> = {
  meal: { accent: "meals", icon: "restaurant" },
  sleep: { accent: "sleep", icon: "moon" },
  activity: { accent: "activity", icon: "color-palette" },
  diaper: { accent: "diaper", icon: "shirt" },
  note: { accent: "primary", icon: "document-text" },
  photo: { accent: "events", icon: "image" },
};

export const NOTIFICATION_CATEGORY: Record<string, EnumVisual> = {
  updates: { accent: "primary", icon: "sparkles" },
  reminders: { accent: "meals", icon: "sunny" },
  events: { accent: "events", icon: "calendar" },
  health: { accent: "health", icon: "medkit" },
  messages: { accent: "hydration", icon: "chatbubble-ellipses" },
  general: { accent: "neutral", icon: "notifications" },
};

export const ATTENDANCE_STATUS: Record<string, EnumVisual> = {
  present: { accent: "activity", icon: "checkmark-circle" },
  absent: { accent: "health", icon: "sad" },
  late: { accent: "meals", icon: "time" },
  early_pickup: { accent: "hydration", icon: "exit" },
};

/** Maps the icon names stored by admins (Ionicons strings) with a safe fallback. */
export function safeIcon(name: string | undefined | null, fallback: string): string {
  return name && name.trim() !== "" ? name : fallback;
}
