import Constants from "expo-constants";
import { LogLevel, OneSignal } from "react-native-onesignal";
import { Platform } from "react-native";
import { api } from "../api/client";
import { queryClient } from "./queryClient";
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

/** Where a tapped notification opens, by the "screen" the backend tags it with. */
const SCREEN_ROUTES: Record<string, string> = {
  diary: "/diary",
  gallery: "/child/gallery",
  events: "/events",
  messages: "/messages",
  announcements: "/messages",
  payments: "/payments",
  community: "/community",
  attendance: "/",
  health: "/child/health",
  milestones: "/child/milestones",
  reports: "/child/report",
  reminders: "/reminders",
  notifications: "/notifications",
};

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
  if (!useAuthStore.getState().accessToken) {
    return;
  }
  try {
    await api.post("/devices", {
      onesignal_player_id: id,
      platform: Platform.OS === "ios" ? "ios" : "android",
      locale: useAuthStore.getState().locale,
    });
    registeredId = id;
  } catch (err) {
    console.error("[Push] Failed to register device with backend:", err);
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

  // iOS suppresses the visible banner for a push that arrives while the app is
  // foregrounded unless the app explicitly displays it — without this, users only
  // feel the vibration and the notification silently waits for the next refetch.
  OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
    event.getNotification().display();

    const data = event.notification.additionalData as
      | { type?: string; conversation_id?: number; screen?: string; child_id?: number }
      | undefined;
    // Badges and the notification list always change.
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    if (data?.type === "chat" && data?.conversation_id) {
      void queryClient.invalidateQueries({ queryKey: ["messages", data.conversation_id] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
    // Attendance changes (parent reported absence, check-in/out) must show on
    // the parent's status pill, the teacher roster and staff queues at once.
    if (data?.type === "attendance" || data?.screen === "attendance") {
      for (const key of [["children"], ["teacherRoster"], ["attendance"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (data?.child_id) void queryClient.invalidateQueries({ queryKey: ["dashboard", data.child_id] });
    }
    if (data?.screen === "gallery" || data?.screen === "diary") {
      if (data?.child_id) {
        void queryClient.invalidateQueries({ queryKey: ["childMedia", data.child_id] });
        void queryClient.invalidateQueries({ queryKey: ["diary", data.child_id] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", data.child_id] });
      }
    }
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
      target = SCREEN_ROUTES[data.screen] ?? "/notifications";
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

async function pollForSubscriptionId(attempts = 0) {
  if (!useAuthStore.getState().accessToken) return;
  const id = await OneSignal.User.pushSubscription.getIdAsync();
  if (id) {
    void syncSubscription(id);
  } else if (attempts < 20) {
    setTimeout(() => {
      void pollForSubscriptionId(attempts + 1);
    }, 1000);
  } else {
    console.warn("[Push] Giving up polling for OneSignal subscription ID after 20 attempts.");
  }
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
  // Periodically check for the subscription ID until OneSignal initialises
  void pollForSubscriptionId();
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

/**
 * What OneSignal knows about this device — shown from a hidden panel in the
 * More tab so a phone that gets no pushes can be diagnosed on the spot.
 */
export async function pushDiagnostics() {
  if (!appId) return { configured: false as const };
  const [permission, subscriptionId, optedIn, externalId] = await Promise.all([
    OneSignal.Notifications.getPermissionAsync().catch(() => false),
    OneSignal.User.pushSubscription.getIdAsync().catch(() => null),
    OneSignal.User.pushSubscription.getOptedInAsync().catch(() => false),
    OneSignal.User.getExternalId().catch(() => null),
  ]);
  return {
    configured: true as const,
    platform: Platform.OS,
    permission,
    subscriptionId,
    optedIn,
    externalId,
    expectedExternalId: useAuthStore.getState().user?.id?.toString() ?? null,
  };
}

/** Re-links this device to the signed-in user and asks for permission again. */
export async function reRegisterPush() {
  const userId = useAuthStore.getState().user?.id;
  if (!appId || !userId) return;
  OneSignal.login(String(userId));
  await OneSignal.Notifications.requestPermission(true);
  OneSignal.User.pushSubscription.optIn();
  void pollForSubscriptionId();
}
