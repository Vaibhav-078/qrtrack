// js/queue.js

const VAPID_PUBLIC_KEY = "BLYm3AiKgdDEYNAv3XvJs4eLG_XnKppnqu1K7MKOBTTpd2o_okkzvt1jj9ipzaxw1-KaIfm1aTn7daMZVrGMvvc"; // same as .env me

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function getPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push not supported");
    return null;
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("Notifications denied");
    return null;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  return subscription;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("joinQueueForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name")?.value.trim();
    const issue = document.getElementById("issue")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const notifyPush = document.getElementById("notifyPush")?.checked;
    const notifyWhatsapp = document.getElementById("notifyWhatsapp")?.checked;

// URL se business info nikaalo
const urlParams = new URLSearchParams(window.location.search);
const businessId = urlParams.get("biz") || "defaultBiz";
const queueId = urlParams.get("queue") || "defaultQueue";
const businessNameFromUrl = urlParams.get("name") || null;

// Heading update
document.addEventListener("DOMContentLoaded", () => {
  const nameEl = document.getElementById("publicBusinessName");
  const subEl = document.getElementById("publicSubheading");

  if (businessNameFromUrl && nameEl) {
    nameEl.textContent = businessNameFromUrl;
  }

  if (businessNameFromUrl && subEl) {
    subEl.textContent = `Get your ticket for ${businessNameFromUrl} by filling the form below.`;
  }

  // agar tumhara form submit wala code yahi DOMContentLoaded ke andar hai
  // to usko yahin rehne do; sirf upar ka heading part add karna hai
});

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
          notifyPush,
          pushSubscription,
          notifyWhatsapp,
          whatsappNumber: phone,
        }),
      });

      if (!res.ok) throw new Error("Failed to create ticket");

      alert("Ticket created! We'll notify you when your turn is next.");
      form.reset();
    } catch (err) {
      console.error(err);
      alert("Error while creating ticket");
    }
  });
});
