import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useMarkSectionRead, type Section } from "../api/hooks";
import { useActiveChild } from "../store/activeChild";

/**
 * Clears the home-screen badge of one or more sections whenever the screen
 * gains focus, however the user got there (home tile, tab, More menu, push).
 */
export function useClearSectionBadge(...screens: Section[]) {
  const markRead = useMarkSectionRead();
  const childId = useActiveChild((s) => s.child?.id);
  const key = screens.join(",");

  useFocusEffect(
    useCallback(() => {
      for (const screen of key.split(",") as Section[]) {
        markRead.mutate({ screen, childId });
      }
      // markRead is stable enough; re-run only when the section or child changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, childId]),
  );
}
