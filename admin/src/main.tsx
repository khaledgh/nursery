import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { useAuthStore } from "./store/auth";
import { applyLocale } from "./i18n";
import "./index.css";

// Restore the persisted locale (and direction) before first paint.
applyLocale(useAuthStore.getState().locale);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
