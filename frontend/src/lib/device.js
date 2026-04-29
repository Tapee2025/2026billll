// Detect which device profile to use for print calibration.
// Returns one of "desktop" | "iphone".
//
// iOS Safari's print engine handles PDF differently from desktop browsers
// (different margin defaults, scaling behavior). Storing two calibration
// profiles lets the app compensate per-device automatically.
export function detectDevice() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPhone, iPad, iPod, plus iPad-on-iPadOS pretending to be Mac with touch
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIOS ? "iphone" : "desktop";
}

export const DEVICE_LABELS = {
  desktop: "Desktop / Laptop",
  iphone: "iPhone / iPad",
};
