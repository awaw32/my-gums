import { networkManager } from "./network-manager.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushAvailable() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!import.meta.env?.VITE_VAPID_PUBLIC_KEY
  );
}

export async function enablePushNotifications() {
  if (!isPushAvailable()) return { ok: false, error: "غير متاح على هذا الجهاز" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "تم رفض إذن الإشعارات" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    });
    await networkManager.post("/api/push/subscribe", { subscription: subscription.toJSON() }, { timeout: 8000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "تعذر تفعيل الإشعارات" };
  }
}
