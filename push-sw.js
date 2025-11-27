// push-sw.js
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}

  const title = data.title || "QRtrack Alert";
  const body = data.body || "You have a notification from QRtrack.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico", // optional, ignore 404
      vibrate: [200, 100, 200],
    })
  );
});
