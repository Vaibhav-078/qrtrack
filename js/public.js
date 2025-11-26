// js/public.js  (NO Firebase, talks to Node API)

// --- URL params se business / queue / name read karo ---
const urlParams = new URLSearchParams(window.location.search);
const businessId = urlParams.get("biz") || "defaultBiz";
const queueId = urlParams.get("queue") || "defaultQueue";
const businessName = urlParams.get("name") || "QRtrack";

// Form & fields
const form = document.getElementById("joinQueueForm");
const nameInput = document.getElementById("name");
const issueInput = document.getElementById("issue");
const phoneInput = document.getElementById("phone");
const notifyPushInput = document.getElementById("notifyPush");
const notifyWhatsappInput = document.getElementById("notifyWhatsapp");

// Simple toast helper (optional)
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) {
    alert(msg);
    return;
  }
  toast.textContent = msg;
  toast.classList.remove("hidden");
  toast.classList.add("toast-success");
  setTimeout(() => {
    toast.classList.add("hidden");
    toast.classList.remove("toast-success");
  }, 2200);
}

// ---- Push subscription (Web Push, NOT Firebase) ----
// yahi public VAPID key use hogi (jo tumne server.js me use ki hai)
const VAPID_PUBLIC_KEY =
  "BKSifakSlI29fS2A-S5pNoHzk0445zUCpUpFinNT525g-nv66n9SZpxgJEhtvgT98RG475X8e2j7veHmy9XcDLo";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeForPushIfNeeded() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push/ServiceWorker not supported in this browser.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission not granted");
      return null;
    }

    // service worker register
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js" // generic SW file, name reused
    );

    // existing subscription?
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    console.log("Push subscription:", sub);
    return sub;
  } catch (err) {
    console.error("Error during push subscription:", err);
    return null;
  }
}

// ---- Form submit ----
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const issue = issueInput.value.trim();
    const phone = phoneInput.value.trim();
    const notifyPush = notifyPushInput.checked;
    const notifyWhatsapp = notifyWhatsappInput.checked;

    if (!name || !issue) {
      showToast("Please fill name and issue");
      return;
    }

    let pushSubscription = null;
    if (notifyPush) {
      pushSubscription = await subscribeForPushIfNeeded();
      if (!pushSubscription) {
        showToast("Browser push not enabled, continuing without it.");
      }
    }

    const payload = {
      businessId,
      queueId,
      name,
      issue,
      notifyPush: !!(notifyPush && pushSubscription),
      pushSubscription: pushSubscription || null,
      notifyWhatsapp: !!(notifyWhatsapp && phone),
      whatsappNumber: phone || null,
    };

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Create ticket error:", data);
        showToast(data.error || "Failed to create ticket");
        return;
      }

      console.log("Ticket created:", data);
      showToast("Ticket created! We'll notify you when your turn is next.");
      form.reset();

      const ticketInfo = document.getElementById("publicTicketInfo");
      const ticketNumberEl = document.getElementById("publicTicketNumber");
      if (ticketInfo && ticketNumberEl) {
        const label = data._id ? data._id.toString().slice(-5) : "";
        ticketNumberEl.textContent = label;
        ticketInfo.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Error creating ticket:", err);
      showToast("Something went wrong while creating ticket.");
    }
  });
}
