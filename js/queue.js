const VAPID_PUBLIC_KEY = "BGgJi7ZdOEKrFWDgkhpDRvNv6SRdTrNNy3-iGDIqQu9f8oHJOy421P0yqjL6-h9eRUPb0Ea3Gi79z-4wH-vzhYI";

// ⬇️ ADD THIS FOR DEBUG
console.log("CLIENT VAPID PUBLIC starts with:", VAPID_PUBLIC_KEY.slice(0, 25));
console.log("CLIENT VAPID PUBLIC length:", VAPID_PUBLIC_KEY.length);

// --- helper: base64 -> Uint8Array ---
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// --- 1) Page load pe SW register ---
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.log("Service worker not supported");
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js", {
      scope: "/",
    });
    console.log("✅ SW registered:", reg);
    return reg;
  } catch (err) {
    console.error("❌ SW register error:", err);
    return null;
  }
}

// --- 2) Push subscription banane ka helper ---
async function getPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push not supported");
    return null;
  }

  // Wait for existing SW
  const reg = await navigator.serviceWorker.ready;
  console.log("✅ SW ready:", reg);

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("Notifications denied");
    return null;
  }

  // Reuse if already subscribed
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    console.log("🛰 Created new subscription:", sub);
  } else {
    console.log("🛰 Reusing existing subscription:", sub);
  }

  return sub;
}

// --- 3) DOM / form logic ---
document.addEventListener("DOMContentLoaded", async () => {
  // SW register as soon as page loads
  await registerServiceWorker();

  const form = document.getElementById("joinQueueForm");
  const nameEl = document.getElementById("publicBusinessName");
  const subEl = document.getElementById("publicSubheading");

  const urlParams = new URLSearchParams(window.location.search);
  const businessId = urlParams.get("biz") || "defaultBiz";
  const queueId = urlParams.get("queue") || "defaultQueue";
  const businessNameFromUrl = urlParams.get("name") || null;

  if (businessNameFromUrl && nameEl) {
    nameEl.textContent = businessNameFromUrl;
  }
  if (businessNameFromUrl && subEl) {
    subEl.textContent = `Get your ticket for ${businessNameFromUrl} by filling the form below.`;
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim();
    const issue = document.getElementById("issue")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const notifyPush = document.getElementById("notifyPush")?.checked;
    const notifyWhatsapp = document.getElementById("notifyWhatsapp")?.checked;

    let pushSubscription = null;
    if (notifyPush) {
      pushSubscription = await getPushSubscription();
    }

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          queueId,
          name,
          issue,
          notifyPush: !!pushSubscription,
          pushSubscription,
          notifyWhatsapp,
          whatsappNumber: phone,
        }),
      });

      if (!res.ok) throw new Error("Failed to create ticket");

      alert("Ticket created! We'll notify you when your turn is next.");
      form.reset();
    } catch (err) {
      console.error("❌ Error while creating ticket:", err);
      alert("Error while creating ticket");
    }
  });
});
