// firebase-messaging-sw.js  (ab generic web-push SW)

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error("Push event data parse error:", e);
  }

  const title = data.title || "QRtrack Notification";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png", // optional
    badge: "/icon-72.png", // optional
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      if (self.registration.scope) {
        return clients.openWindow(self.registration.scope);
      }
    })
  );
});
