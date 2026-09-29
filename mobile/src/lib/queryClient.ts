import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Screens share data through the cache; live changes arrive through
      // invalidation (mutations, pushes, the chat socket), so data can stay
      // fresh for a couple of minutes without re-downloading on every visit.
      staleTime: 2 * 60_000,
      gcTime: 15 * 60_000,
    },
  },
});

// React Query can't see the app lifecycle on native. Tell it when the app is
// in the foreground: polling pauses in the background (no battery drain) and
// stale screens refresh once when the user comes back.
if (Platform.OS !== "web") {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener("change", (state) => setFocused(state === "active"));
    return () => sub.remove();
  });
}
