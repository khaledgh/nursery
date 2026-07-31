import { colors, fonts } from "../theme";

/**
 * The floating pill tab bar. Shared by the parent and teacher layouts so the
 * two roles get an identical chrome — only the tabs inside it differ.
 */
// `as const` keeps literals like headerTitleAlign: "center" narrow, which the
// navigator's option types require.
export const tabScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
  headerTitleAlign: "center",
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: {
    backgroundColor: colors.card,
    borderTopWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 64,
    paddingTop: 6,
    position: "absolute",
    shadowColor: "#3f7222",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
} as const;
