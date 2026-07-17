// Re-establishes the USB tunnel for the API port before Metro starts.
// The tunnel (adb reverse tcp:8080) is lost whenever the phone reconnects,
// which makes the app show "Cannot reach the server" on login.
const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const API_PORT = 8080;

function findAdb() {
  const candidates = [
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe"),
    process.env.HOME && path.join(process.env.HOME, "Library", "Android", "sdk", "platform-tools", "adb"),
    "adb", // PATH fallback
  ].filter(Boolean);
  return candidates.find((c) => c === "adb" || existsSync(c)) ?? "adb";
}

try {
  const adb = findAdb();
  execFileSync(adb, ["reverse", `tcp:${API_PORT}`, `tcp:${API_PORT}`], { stdio: "ignore" });
  console.log(`adb reverse tcp:${API_PORT} ready — phone can reach the local API`);
} catch {
  // No device / no adb — fine, the app may be using the LAN address instead.
  console.log("adb reverse skipped (no device connected?)");
}
