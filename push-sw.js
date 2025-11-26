// push-sw.js

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.title || "QRtrack Update";
  const options = {
    body: payload.body || "",
    // icon: "/icon-192.png", // agar nahi hai to hata do
    data: payload,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // yahan koi URL open kara sakte ho in future
});
