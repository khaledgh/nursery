import { StyleSheet, Text } from "react-native";
import { colors, fonts } from "../theme";

/** Message for a single input, rendered directly beneath it. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fonts.semibold,
    marginTop: -6,
    marginBottom: 2,
  },
});
