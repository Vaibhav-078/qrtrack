// firebase-messaging-sw.js
// Ab FCM nahi, plain Web Push ke liye SW

self.addEventListener("install", (event) => {
  console.log("[SW] Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activated");
});

self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error("[SW] Error parsing push data", e);
  }

  const title = data.title || "QRtrack Notification";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png", // optional, agar tumhare paas ye icons nahi to hata sakte ho
    badge: "/icon-72.png",
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // future me yahan se specific page open kara sakte ho
});
