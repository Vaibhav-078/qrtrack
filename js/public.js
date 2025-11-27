// js/public.js

const urlParams = new URLSearchParams(window.location.search);
const businessId = urlParams.get("biz") || "defaultBiz";
const queueId = urlParams.get("queue") || "defaultQueue";
const businessName = urlParams.get("name") || "QRtrack";

// --- VAPID public key EXACTLY same jo .env me VAPID_PUBLIC_KEY hai ---
const VAPID_PUBLIC_KEY =
  "BGgJi7ZdOEKrFWDgkhpDRvNv6SRdTrNNy3-iGDIqQu9f8oHJOy421P0yqjL6-h9eRUPb0Ea3Gi79z-4wH-vzhYI";

// helper: urlBase64 string -> Uint8Array (pushManager ke liye)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("❌ Push not supported in this browser");
    return null;
  }

  try {
    // same SW file jo root me hai (firebase-messaging-sw.js)
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    console.log("✅ Service worker registered", reg);

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("🛰 New push subscription:", sub);
    } else {
      console.log("🛰 Existing push subscription:", sub);
    }

    return sub;
  } catch (err) {
    console.error("❌ Error creating push subscription", err);
    return null;
  }
}

const form = document.getElementById("joinQueueForm");
const toast = document.getElementById("toast");

function showToast(message, type = "success") {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden", "toast-success", "toast-error");
  toast.classList.add(type === "error" ? "toast-error" : "toast-success");
  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const issue = document.getElementById("issue").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const notifyPush = document.getElementById("notifyPush").checked;
    const notifyWhatsapp = document.getElementById("notifyWhatsapp").checked;

    let pushSubscription = null;

    if (notifyPush) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Please allow notifications to receive browser alerts.");
      } else {
        pushSubscription = await getPushSubscription();
      }
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
          notifyWhatsapp: notifyWhatsapp && !!phone,
          whatsappNumber: phone || null,
        }),
      });

      if (!res.ok) {
        console.error("❌ Ticket create error:", await res.text());
        alert("Something went wrong while creating ticket.");
        return;
      }

      const data = await res.json();
      console.log("🎫 Ticket created:", data);
      showToast("Ticket created! We'll notify you when your turn is next.");

      form.reset();
    } catch (err) {
      console.error("❌ Ticket create error:", err);
      alert("Something went wrong while creating ticket.");
    }
  });
}
