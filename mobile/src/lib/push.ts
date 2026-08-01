import Constants from "expo-constants";
import { LogLevel, OneSignal } from "react-native-onesignal";
import { Platform } from "react-native";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";

const appId = (Constants.expoConfig?.extra?.oneSignalAppId as string | undefined) ?? "";

/** Safely perform router navigation deferred until Expo Router layout has mounted */
function safeNavigate(targetUrl: string) {
  setTimeout(() => {
    try {
      const { router } = require("expo-router");
      router.push(targetUrl);
    } catch {
      setTimeout(() => {
        try {
          const { router } = require("expo-router");
          router.push(targetUrl);
        } catch {}
      }, 500);
    }
  }, 300);
}

/** The id OneSignal last reported for this device, so we only POST on change. */
let registeredId: string | null = null;

/**
 * Sends the device's push subscription to the API.
 *
 * POST /devices is JWT-protected, so this is a no-op until the user is logged
 * in; onAuthenticated() replays it once a token exists.
 */
async function syncSubscription(id: string | null | undefined) {
  if (!id || id === registeredId) return;
  if (!useAuthStore.getState().accessToken) return;
  try {
    await api.post("/devices", {
      onesignal_player_id: id,
      platform: Platform.OS === "ios" ? "ios" : "android",
      locale: useAuthStore.getState().locale,
    });
    registeredId = id;
  } catch {
    // A failed registration only costs this device its pushes; leaving
    // registeredId unset means the next auth change retries.
  }
}

/**
 * Initialises OneSignal. Safe to call when unconfigured — without an app id the
 * SDK is skipped entirely so the app still runs (mirroring the backend, which
 * disables push when its keys are absent).
 */
export function initPush() {
  if (!appId) return;

  if (__DEV__) OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  OneSignal.initialize(appId);

  // Foreground notification display (WhatsApp style heads-up alert)
  OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
    event.getNotification().display();
  });

  // Deep linking on notification tap
  OneSignal.Notifications.addEventListener("click", (event: any) => {
    const data = event.notification.additionalData as { url?: string; type?: string; conversation_id?: number; screen?: string } | undefined;
    let target = "/notifications";
    if (data?.url) {
      target = data.url;
    } else if (data?.type === "chat" && data?.conversation_id) {
      target = `/chat/${data.conversation_id}`;
    } else if (data?.screen) {
      target = `/${data.screen}`;
    }
    safeNavigate(target);
  });

  // Fires whenever the subscription id changes — including the first time it is
  // issued, which is usually after this function has already returned.
  OneSignal.User.pushSubscription.addEventListener("change", (event) => {
    void syncSubscription(event.current.id);
  });

  watchAuth();
}

/**
 * Once the user is logged in: ask for permission, tie the device to the
 * account, and register the subscription that init may have raced past.
 */
function onAuthenticated(userId: number) {
  // External id lets the backend target a person across their devices.
  OneSignal.login(String(userId));
  // Request full OS push notification permissions (alert banner, sound, badge).
  void OneSignal.Notifications.requestPermission(true);
  // The change listener covers ids issued later; this catches one already
  // assigned before login (a returning user on a known device).
  void OneSignal.User.pushSubscription.getIdAsync().then(syncSubscription);
}

/** On logout, so the next account on this device is not pushed to. */
function onLoggedOut() {
  OneSignal.logout();
  registeredId = null;
}

/**
 * Follows the auth store rather than the login screen: tokens are also cleared
 * by the refresh interceptor on expiry, and restored from the keychain at
 * startup, neither of which passes through a UI handler.
 */
function watchAuth() {
  let previous = useAuthStore.getState().user?.id ?? null;
  if (previous !== null) onAuthenticated(previous);

  useAuthStore.subscribe((state) => {
    const current = state.user?.id ?? null;
    if (current === previous) return;
    previous = current;
    if (current === null) onLoggedOut();
    else onAuthenticated(current);
  });
}
