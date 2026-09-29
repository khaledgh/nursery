import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { api } from "../api/client";
import { useActiveChild, type ChildSummary } from "../store/activeChild";
import { colors, fonts, radius, spacing } from "../theme";
import { ChildAvatar } from "./ChildAvatar";
import { Tap } from "./Tap";

/** Horizontal child picker with avatars; auto-selects the first child on load. */
export function ChildSwitcher() {
  const { child, setChild } = useActiveChild();

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const res = await api.get<{ data: ChildSummary[] }>("/children", { params: { per_page: 20 } });
      return res.data.data;
    },
  });

  useEffect(() => {
    const list = children.data;
    if (!list || list.length === 0) return;
    if (!child) {
      setChild(list[0]);
      return;
    }
    // Keep the selection in sync with fresh data (edited name/photo, absence
    // status…): the store holds a snapshot, not a live query.
    const fresh = list.find((c) => c.id === child.id);
    if (!fresh) setChild(list[0]);
    else if (fresh !== child) setChild(fresh);
  }, [child, children.data, setChild]);

  if (!children.data || children.data.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children.data.map((c) => {
        const active = child?.id === c.id;
        return (
          <Tap key={c.id} onPress={() => setChild(c)} style={[styles.chip, active && styles.chipActive]}>
            <ChildAvatar url={c.avatar?.url} name={c.first_name} size={28} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.first_name}</Text>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  chipTextActive: { color: "#fff" },
});
